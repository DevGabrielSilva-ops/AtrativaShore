export type ValorLido = string | Buffer | null;

export type EventoSql =
  | { tipo: 'criar'; tabela: string; colunas: string[] }
  | { tipo: 'inserir'; tabela: string; colunas: string[] | null; linhas: ValorLido[][] };

const PALAVRAS_DE_INDICE = new Set(['PRIMARY', 'KEY', 'UNIQUE', 'INDEX', 'CONSTRAINT', 'FULLTEXT', 'SPATIAL', 'FOREIGN', 'CHECK', 'PERIOD']);

export async function* separarInstrucoes(partes: AsyncIterable<string> | Iterable<string>): AsyncGenerator<string> {
  let atual: string[] = [];
  let pedaco = '';
  let aspas: string | null = null;
  let escape = false;
  let comentario: 'linha' | 'bloco' | null = null;
  let resto = '';
  const prontas: string[] = [];

  let inicioDeLinha = true;
  const anexar = (trecho: string) => {
    pedaco += trecho;
    const quebra = trecho.lastIndexOf('\n');
    const final = quebra >= 0 ? trecho.slice(quebra + 1) : trecho;
    inicioDeLinha = (quebra >= 0 || inicioDeLinha) && /^[ \t\r]*$/.test(final);
  };
  const ESPECIAIS = /['"`;#/-]/g;
  const processar = (texto: string, final: boolean): number => {
    const limite = final ? texto.length : texto.length - 2;
    let i = 0;
    while (i < limite) {
      if (comentario === 'linha') {
        const fim = texto.indexOf('\n', i);
        if (fim < 0 || fim >= limite) return limite;
        comentario = null;
        anexar('\n');
        i = fim + 1;
        continue;
      }
      if (comentario === 'bloco') {
        const fim = texto.indexOf('*/', i);
        if (fim < 0 || fim >= limite) return Math.max(i, limite - 1);
        comentario = null;
        pedaco += ' ';
        i = fim + 2;
        continue;
      }
      if (aspas) {
        let j = i;
        while (j < limite) {
          const c = texto[j];
          if (escape) escape = false;
          else if (c === '\\' && aspas !== '`') escape = true;
          else if (c === aspas) {
            if (texto[j + 1] === aspas) {
              j += 2;
              continue;
            }
            break;
          }
          j += 1;
        }
        if (j >= limite) {
          anexar(texto.slice(i, j));
          return j;
        }
        anexar(texto.slice(i, j + 1));
        aspas = null;
        i = j + 1;
        continue;
      }
      ESPECIAIS.lastIndex = i;
      const achado = ESPECIAIS.exec(texto);
      const j = achado && achado.index < limite ? achado.index : limite;
      if (j > i) anexar(texto.slice(i, j));
      if (j >= limite) return limite;
      const c = texto[j];
      if (c === '-') {
        if (texto[j + 1] === '-' && (inicioDeLinha || j + 2 >= texto.length || /\s/.test(texto[j + 2]))) {
          comentario = 'linha';
          i = j + 2;
        } else {
          anexar(c);
          i = j + 1;
        }
        continue;
      }
      if (c === '/') {
        if (texto[j + 1] === '*') {
          comentario = 'bloco';
          i = j + 2;
        } else {
          anexar(c);
          i = j + 1;
        }
        continue;
      }
      if (c === '#') {
        comentario = 'linha';
        i = j + 1;
        continue;
      }
      if (c === ';') {
        atual.push(pedaco);
        pedaco = '';
        const instrucao = atual.join('').trim();
        atual = [];
        if (instrucao) prontas.push(instrucao);
        i = j + 1;
        continue;
      }
      aspas = c;
      anexar(c);
      i = j + 1;
      if (pedaco.length > 65536) {
        atual.push(pedaco);
        pedaco = '';
      }
    }
    return i;
  };

  for await (const parte of partes) {
    const texto = resto + parte;
    const parada = processar(texto, false);
    resto = texto.slice(parada);
    while (prontas.length) yield prontas.shift()!;
  }
  processar(resto, true);
  while (prontas.length) yield prontas.shift()!;
  atual.push(pedaco);
  const sobra = atual.join('').trim();
  if (sobra) yield sobra;
}

export function lerIdentificador(texto: string, inicio: number): { nome: string; fim: number } | null {
  let i = inicio;
  while (i < texto.length && /\s/.test(texto[i])) i += 1;
  if (texto[i] === '`') {
    let nome = '';
    i += 1;
    while (i < texto.length) {
      if (texto[i] === '`') {
        if (texto[i + 1] === '`') {
          nome += '`';
          i += 2;
          continue;
        }
        return { nome, fim: i + 1 };
      }
      nome += texto[i];
      i += 1;
    }
    return null;
  }
  const m = /^[A-Za-z0-9_$]+/.exec(texto.slice(i, i + 200));
  return m ? { nome: m[0], fim: i + m[0].length } : null;
}

function lerNomeDeTabela(texto: string, inicio: number): { nome: string; fim: number } | null {
  const primeiro = lerIdentificador(texto, inicio);
  if (!primeiro) return null;
  if (texto[primeiro.fim] === '.') {
    const segundo = lerIdentificador(texto, primeiro.fim + 1);
    if (segundo) return segundo;
  }
  return primeiro;
}

const ESCAPES: Record<string, string> = { '0': '\0', b: '\b', n: '\n', r: '\r', t: '\t', Z: '\x1a', "'": "'", '"': '"', '\\': '\\' };

function lerTexto(texto: string, inicio: number): { valor: string; fim: number } {
  const aspas = texto[inicio];
  let valor = '';
  let i = inicio + 1;
  while (i < texto.length) {
    const c = texto[i];
    if (c === '\\') {
      const proximo = texto[i + 1];
      if (proximo === '%' || proximo === '_') valor += `\\${proximo}`;
      else valor += ESCAPES[proximo] ?? proximo ?? '';
      i += 2;
      continue;
    }
    if (c === aspas) {
      if (texto[i + 1] === aspas) {
        valor += aspas;
        i += 2;
        continue;
      }
      return { valor, fim: i + 1 };
    }
    valor += c;
    i += 1;
  }
  throw new Error('Texto sem aspas de fechamento no arquivo');
}

function pularEspacos(texto: string, i: number): number {
  while (i < texto.length && /\s/.test(texto[i])) i += 1;
  return i;
}

function lerValor(texto: string, inicio: number): { valor: ValorLido; fim: number } {
  let i = pularEspacos(texto, inicio);
  let c = texto[i];
  if (c === '_') {
    const introdutor = /^_[A-Za-z0-9]+\s*(?=['"])/.exec(texto.slice(i, i + 40));
    if (introdutor) {
      i += introdutor[0].length;
      c = texto[i];
    }
  }
  if (c === "'" || c === '"') {
    const lido = lerTexto(texto, i);
    return { valor: lido.valor, fim: lido.fim };
  }
  const trecho = texto.slice(i, i + 64);
  let m = /^0x([0-9A-Fa-f]*)/.exec(trecho);
  if (m) {
    let fim = i + 2;
    while (fim < texto.length && /[0-9A-Fa-f]/.test(texto[fim])) fim += 1;
    return { valor: Buffer.from(texto.slice(i + 2, fim), 'hex'), fim };
  }
  if (/^[xX]'/.test(trecho)) {
    const fecha = texto.indexOf("'", i + 2);
    if (fecha < 0) throw new Error('Valor hexadecimal sem aspas de fechamento no arquivo');
    return { valor: Buffer.from(texto.slice(i + 2, fecha), 'hex'), fim: fecha + 1 };
  }
  m = /^[bB]'([01]*)'/.exec(trecho);
  if (m) return { valor: m[1] ? String(parseInt(m[1], 2)) : '0', fim: i + m[0].length };
  m = /^NULL\b/i.exec(trecho);
  if (m) return { valor: null, fim: i + 4 };
  m = /^(TRUE|FALSE)\b/i.exec(trecho);
  if (m) return { valor: m[1].toUpperCase() === 'TRUE' ? '1' : '0', fim: i + m[0].length };
  m = /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?/.exec(trecho);
  if (m) return { valor: m[0], fim: i + m[0].length };
  throw new Error(`Valor não reconhecido no arquivo: ${trecho.slice(0, 30)}`);
}

export function lerTuplas(texto: string, inicio: number): ValorLido[][] {
  const linhas: ValorLido[][] = [];
  let i = pularEspacos(texto, inicio);
  while (i < texto.length) {
    if (texto[i] !== '(') break;
    i += 1;
    const linha: ValorLido[] = [];
    for (;;) {
      i = pularEspacos(texto, i);
      if (texto[i] === ')' && linha.length === 0) {
        i += 1;
        break;
      }
      const { valor, fim } = lerValor(texto, i);
      linha.push(valor);
      i = pularEspacos(texto, fim);
      if (texto[i] === ',') {
        i += 1;
        continue;
      }
      if (texto[i] === ')') {
        i += 1;
        break;
      }
      throw new Error('Linha de INSERT malformada no arquivo');
    }
    linhas.push(linha);
    i = pularEspacos(texto, i);
    if (texto[i] === ',') {
      i = pularEspacos(texto, i + 1);
      continue;
    }
    break;
  }
  return linhas;
}

function dividirNoNivelZero(texto: string): string[] {
  const partes: string[] = [];
  let nivel = 0;
  let aspas: string | null = null;
  let inicio = 0;
  for (let i = 0; i < texto.length; i += 1) {
    const c = texto[i];
    if (aspas) {
      if (c === '\\' && aspas !== '`') i += 1;
      else if (c === aspas) aspas = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') aspas = c;
    else if (c === '(') nivel += 1;
    else if (c === ')') nivel -= 1;
    else if (c === ',' && nivel === 0) {
      partes.push(texto.slice(inicio, i));
      inicio = i + 1;
    }
  }
  partes.push(texto.slice(inicio));
  return partes;
}

export function interpretarInstrucao(instrucao: string): EventoSql | null {
  const criar = /^CREATE\s+(?:TEMPORARY\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?/i.exec(instrucao);
  if (criar) {
    const tabela = lerNomeDeTabela(instrucao, criar[0].length);
    if (!tabela) return null;
    const abre = instrucao.indexOf('(', tabela.fim);
    if (abre < 0) return null;
    let nivel = 0;
    let aspas: string | null = null;
    let fecha = -1;
    for (let i = abre; i < instrucao.length; i += 1) {
      const c = instrucao[i];
      if (aspas) {
        if (c === '\\' && aspas !== '`') i += 1;
        else if (c === aspas) aspas = null;
        continue;
      }
      if (c === "'" || c === '"' || c === '`') aspas = c;
      else if (c === '(') nivel += 1;
      else if (c === ')') {
        nivel -= 1;
        if (nivel === 0) {
          fecha = i;
          break;
        }
      }
    }
    if (fecha < 0) return null;
    const colunas: string[] = [];
    for (const definicao of dividirNoNivelZero(instrucao.slice(abre + 1, fecha))) {
      const nome = lerIdentificador(definicao, 0);
      if (!nome) continue;
      const crua = definicao.trim();
      if (!crua.startsWith('`') && PALAVRAS_DE_INDICE.has(nome.nome.toUpperCase())) continue;
      colunas.push(nome.nome);
    }
    return { tipo: 'criar', tabela: tabela.nome, colunas };
  }

  const inserir = /^(?:INSERT|REPLACE)\s+(?:(?:LOW_PRIORITY|DELAYED|HIGH_PRIORITY|IGNORE)\s+)*(?:INTO\s+)?/i.exec(instrucao);
  if (!inserir) return null;
  const tabela = lerNomeDeTabela(instrucao, inserir[0].length);
  if (!tabela) return null;
  let i = pularEspacos(instrucao, tabela.fim);
  let colunas: string[] | null = null;
  if (instrucao[i] === '(') {
    const fecha = instrucao.indexOf(')', i);
    if (fecha < 0) return null;
    colunas = instrucao
      .slice(i + 1, fecha)
      .split(',')
      .map((parte) => lerIdentificador(parte, 0)?.nome ?? '')
      .filter(Boolean);
    i = pularEspacos(instrucao, fecha + 1);
  }
  const valores = /^VALUES?\b/i.exec(instrucao.slice(i, i + 7));
  if (!valores) return null;
  return { tipo: 'inserir', tabela: tabela.nome, colunas, linhas: lerTuplas(instrucao, i + valores[0].length) };
}

export async function* lerEventosSql(partes: AsyncIterable<string> | Iterable<string>): AsyncGenerator<EventoSql> {
  for await (const instrucao of separarInstrucoes(partes)) {
    const evento = interpretarInstrucao(instrucao);
    if (evento) yield evento;
  }
}
