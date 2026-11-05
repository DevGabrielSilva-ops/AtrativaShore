import type { DataSource, QueryRunner } from 'typeorm';
import type { FonteImportacao } from './fonte-importacao.js';
import type { ValorLido } from './leitor-sql.js';
import { identificador } from './sql.js';

export const TABELAS_PROTEGIDAS: Record<string, string> = {
  api_credencial: 'credenciais de acesso da API',
  api_migrations: 'controle de versão do banco',
};

export const COLUNAS_DESCARTADAS: Record<string, string[]> = {
  cad_login: ['senha'],
};

export const PRESERVAR_SE_NULO: Record<string, string[]> = {
  cad_empresa: ['chave_liberacao'],
};

const LIMITE_PARAMETROS = 30000;

export interface TabelaDoEsquema {
  nome: string;
  colunas: string[];
  motor: string;
}

export type EsquemaEmpresa = Map<string, TabelaDoEsquema>;

export interface TabelaAnalisada {
  tabela: string;
  registros: number;
  acao: 'SUBSTITUIR' | 'IGNORAR';
  motivo: string | null;
  colunasIgnoradas: string[];
  colunasSemValor: string[];
  transacional: boolean;
}

export interface UsuarioLegado {
  id: number;
  login: string | null;
  perfil: string | null;
}

export interface Analise {
  tabelas: TabelaAnalisada[];
  registros: number;
  usuariosLegados: UsuarioLegado[];
  avisos: string[];
}

export interface ResultadoAplicacao {
  tabelas: Array<{ tabela: string; registros: number }>;
  registros: number;
}

export async function lerEsquema(fonte: Pick<DataSource, 'query'>): Promise<EsquemaEmpresa> {
  const tabelas = (await fonte.query(
    "SELECT TABLE_NAME AS nome, ENGINE AS motor FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'",
  )) as Array<{ nome: string; motor: string | null }>;
  const colunas = (await fonte.query(
    'SELECT TABLE_NAME AS tabela, COLUMN_NAME AS coluna FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME, ORDINAL_POSITION',
  )) as Array<{ tabela: string; coluna: string }>;
  const esquema: EsquemaEmpresa = new Map();
  for (const t of tabelas) esquema.set(t.nome.toLowerCase(), { nome: t.nome, colunas: [], motor: t.motor ?? '' });
  for (const c of colunas) esquema.get(c.tabela.toLowerCase())?.colunas.push(c.coluna);
  return esquema;
}

interface Plano {
  destino: TabelaDoEsquema;
  indices: Array<{ origem: number; coluna: string; descartar: boolean }>;
}

class Mapeador {
  private readonly colunasDoArquivo = new Map<string, string[]>();
  private readonly planos = new Map<string, Plano | null>();

  constructor(private readonly esquema: EsquemaEmpresa) {}

  destino(tabela: string): TabelaDoEsquema | null {
    const chave = tabela.toLowerCase();
    if (chave in TABELAS_PROTEGIDAS) return null;
    return this.esquema.get(chave) ?? null;
  }

  registrarColunas(tabela: string, colunas: string[]): void {
    this.colunasDoArquivo.set(tabela.toLowerCase(), colunas);
    this.planos.delete(`${tabela.toLowerCase()}|`);
  }

  colunas(tabela: string, explicitas: string[] | null): string[] {
    const colunas = explicitas ?? this.colunasDoArquivo.get(tabela.toLowerCase());
    if (!colunas) throw new Error(`A tabela ${tabela} tem INSERT sem lista de colunas e sem CREATE TABLE no arquivo`);
    return colunas;
  }

  plano(tabela: string, explicitas: string[] | null): Plano | null {
    const chave = `${tabela.toLowerCase()}|${explicitas?.join(',') ?? ''}`;
    if (this.planos.has(chave)) return this.planos.get(chave)!;
    const destino = this.destino(tabela);
    let plano: Plano | null = null;
    if (destino) {
      const porNome = new Map(destino.colunas.map((c) => [c.toLowerCase(), c]));
      const descartar = COLUNAS_DESCARTADAS[destino.nome.toLowerCase()] ?? [];
      plano = {
        destino,
        indices: this.colunas(tabela, explicitas)
          .map((coluna, origem) => ({ origem, coluna: porNome.get(coluna.toLowerCase()) ?? '', descartar: descartar.includes(coluna.toLowerCase()) }))
          .filter((i) => i.coluna),
      };
    }
    this.planos.set(chave, plano);
    return plano;
  }
}

export async function analisar(
  fonte: FonteImportacao,
  esquema: EsquemaEmpresa,
  aoProgresso: (registros: number) => void = () => undefined,
): Promise<Analise> {
  const mapeador = new Mapeador(esquema);
  const vistas = new Map<string, { nome: string; registros: number; colunas: Set<string> }>();
  const logins: Array<{ linha: ValorLido[]; colunas: string[] }> = [];
  const perfis = new Map<string, string | null>();
  let registros = 0;
  let instrucoes = 0;

  const ver = (tabela: string) => {
    const chave = tabela.toLowerCase();
    let vista = vistas.get(chave);
    if (!vista) {
      vista = { nome: tabela, registros: 0, colunas: new Set() };
      vistas.set(chave, vista);
    }
    return vista;
  };

  for await (const evento of fonte.eventos()) {
    instrucoes += 1;
    const vista = ver(evento.tabela);
    if (evento.tipo === 'criar') {
      mapeador.registrarColunas(evento.tabela, evento.colunas);
      for (const c of evento.colunas) vista.colunas.add(c);
      continue;
    }
    const colunas = mapeador.colunas(evento.tabela, evento.colunas);
    for (const c of colunas) vista.colunas.add(c);
    evento.linhas.forEach((linha, posicao) => {
      if (linha.length !== colunas.length) {
        throw new Error(
          `Tabela ${evento.tabela}: uma linha tem ${linha.length} valores, mas a tabela tem ${colunas.length} colunas (registro ${vista.registros + posicao + 1})`,
        );
      }
    });
    vista.registros += evento.linhas.length;
    registros += evento.linhas.length;
    aoProgresso(registros);
    const chave = evento.tabela.toLowerCase();
    if (chave === 'cad_login') for (const linha of evento.linhas) logins.push({ linha, colunas });
    if (chave === 'cad_login_perfil') {
      const id = colunas.findIndex((c) => c.toLowerCase() === 'id_perfil');
      const nome = colunas.findIndex((c) => c.toLowerCase() === 'nome_perfil');
      for (const linha of evento.linhas) perfis.set(String(linha[id]), nome >= 0 ? (linha[nome] as string | null) : null);
    }
  }
  if (instrucoes === 0) throw new Error('Nenhuma tabela encontrada no arquivo. Envie um dump SQL (mysqldump) ou um backup ZIP do Atrativa Shore.');

  const avisos: string[] = [];
  const tabelas: TabelaAnalisada[] = [...vistas.values()]
    .map((vista) => {
      const chave = vista.nome.toLowerCase();
      const destino = mapeador.destino(vista.nome);
      if (!destino) {
        return {
          tabela: vista.nome,
          registros: vista.registros,
          acao: 'IGNORAR' as const,
          motivo: chave in TABELAS_PROTEGIDAS ? `Protegida: ${TABELAS_PROTEGIDAS[chave]}` : 'Tabela não existe no sistema atual',
          colunasIgnoradas: [],
          colunasSemValor: [],
          transacional: true,
        };
      }
      const doDestino = new Set(destino.colunas.map((c) => c.toLowerCase()));
      const doArquivo = new Set([...vista.colunas].map((c) => c.toLowerCase()));
      return {
        tabela: destino.nome,
        registros: vista.registros,
        acao: 'SUBSTITUIR' as const,
        motivo: null,
        colunasIgnoradas: [...vista.colunas].filter((c) => !doDestino.has(c.toLowerCase())),
        colunasSemValor: destino.colunas.filter((c) => !doArquivo.has(c.toLowerCase())),
        transacional: destino.motor.toUpperCase() === 'INNODB',
      };
    })
    .sort((a, b) => a.tabela.localeCompare(b.tabela));

  const substituir = tabelas.filter((t) => t.acao === 'SUBSTITUIR');
  if (!substituir.length) throw new Error('Nenhuma tabela do arquivo corresponde às tabelas do sistema atual.');
  const ignoradas = tabelas.filter((t) => t.acao === 'IGNORAR' && !(t.tabela.toLowerCase() in TABELAS_PROTEGIDAS));
  if (ignoradas.length) avisos.push(`Tabelas sem correspondente no sistema atual serão ignoradas: ${ignoradas.map((t) => t.tabela).join(', ')}.`);
  for (const t of substituir) {
    if (t.colunasIgnoradas.length) avisos.push(`${t.tabela}: colunas ignoradas (não existem mais): ${t.colunasIgnoradas.join(', ')}.`);
  }
  if (fonte.codificacao === 'latin1') {
    avisos.push('O arquivo não está em UTF-8; os textos foram lidos como Latin-1, sem conversão, como no sistema anterior.');
  }
  if (substituir.some((t) => t.tabela.toLowerCase() === 'cad_login')) {
    avisos.push('As senhas do sistema anterior (cad_login.senha) não são importadas.');
  }

  const usuariosLegados: UsuarioLegado[] = logins
    .map(({ linha, colunas }) => {
      const valor = (nome: string) => {
        const i = colunas.findIndex((c) => c.toLowerCase() === nome);
        return i >= 0 ? linha[i] : null;
      };
      const perfil = valor('id_perfil');
      return {
        id: Number(valor('id')),
        login: (valor('login') as string | null)?.trim() || null,
        perfil: perfil === null ? null : (perfis.get(String(perfil)) ?? null),
      };
    })
    .filter((u) => Number.isInteger(u.id) && u.id > 0);

  return { tabelas, registros: substituir.reduce((a, t) => a + t.registros, 0), usuariosLegados, avisos };
}

export async function aplicar(
  executor: QueryRunner,
  fonte: FonteImportacao,
  esquema: EsquemaEmpresa,
  aoProgresso: (registros: number, tabela: string) => void | Promise<void>,
): Promise<ResultadoAplicacao> {
  const mapeador = new Mapeador(esquema);
  const limpas = new Map<string, number>();
  const preservados = new Map<string, Array<Record<string, unknown>>>();
  let registros = 0;

  const limpar = async (tabela: string) => {
    const destino = mapeador.destino(tabela);
    if (!destino || limpas.has(destino.nome)) return destino;
    const manter = PRESERVAR_SE_NULO[destino.nome.toLowerCase()];
    if (manter?.length && destino.colunas.some((c) => c.toLowerCase() === 'id')) {
      const colunas = manter.filter((c) => destino.colunas.includes(c));
      if (colunas.length) {
        preservados.set(
          destino.nome,
          (await executor.query(
            `SELECT id, ${colunas.map(identificador).join(', ')} FROM ${identificador(destino.nome)}`,
          )) as Array<Record<string, unknown>>,
        );
      }
    }
    await executor.query(`DELETE FROM ${identificador(destino.nome)}`);
    limpas.set(destino.nome, 0);
    await aoProgresso(registros, destino.nome);
    return destino;
  };

  for await (const evento of fonte.eventos()) {
    if (evento.tipo === 'criar') {
      mapeador.registrarColunas(evento.tabela, evento.colunas);
      await limpar(evento.tabela);
      continue;
    }
    const destino = await limpar(evento.tabela);
    if (!destino) continue;
    const plano = mapeador.plano(evento.tabela, evento.colunas)!;
    if (!plano.indices.length) continue;
    const colunasSql = plano.indices.map((i) => identificador(i.coluna)).join(', ');
    const porLote = Math.max(1, Math.min(1000, Math.floor(LIMITE_PARAMETROS / plano.indices.length)));
    const marcador = `(${plano.indices.map(() => '?').join(',')})`;
    for (let inicio = 0; inicio < evento.linhas.length; inicio += porLote) {
      const lote = evento.linhas.slice(inicio, inicio + porLote);
      const parametros: ValorLido[] = [];
      for (const linha of lote) for (const i of plano.indices) parametros.push(i.descartar ? null : linha[i.origem]);
      await executor.query(
        `INSERT INTO ${identificador(destino.nome)} (${colunasSql}) VALUES ${lote.map(() => marcador).join(',')}`,
        parametros,
      );
    }
    registros += evento.linhas.length;
    limpas.set(destino.nome, (limpas.get(destino.nome) ?? 0) + evento.linhas.length);
    await aoProgresso(registros, destino.nome);
  }

  for (const [tabela, linhas] of preservados) {
    for (const linha of linhas) {
      for (const [coluna, valor] of Object.entries(linha)) {
        if (coluna === 'id' || valor === null) continue;
        await executor.query(
          `UPDATE ${identificador(tabela)} SET ${identificador(coluna)} = ? WHERE id = ? AND ${identificador(coluna)} IS NULL`,
          [valor, linha.id],
        );
      }
    }
  }

  return { tabelas: [...limpas.entries()].map(([tabela, total]) => ({ tabela, registros: total })), registros };
}
