import { createReadStream } from 'node:fs';
import { open, readFile } from 'node:fs/promises';
import { lerZip, type EntradaLida } from './ler-zip.js';
import { lerEventosSql, type EventoSql, type ValorLido } from './leitor-sql.js';

export type OrigemImportacao = 'BACKUP_ATRATIVA' | 'DUMP_SQL';

export interface MetadadosOrigem {
  formato: string;
  versaoFormato: number;
  geradoEm: string | null;
  empresa: { id: number; nome: string } | null;
}

export interface FonteImportacao {
  origem: OrigemImportacao;
  codificacao: 'utf8' | 'latin1';
  metadados: MetadadosOrigem | null;
  eventos(): AsyncIterable<EventoSql>;
}

const TAMANHO_PEDACO = 1 << 20;

function* emPedacos(texto: string): Generator<string> {
  for (let i = 0; i < texto.length; i += TAMANHO_PEDACO) yield texto.slice(i, i + TAMANHO_PEDACO);
}

export async function ehUtf8(caminho: string): Promise<boolean> {
  const decodificador = new TextDecoder('utf-8', { fatal: true });
  try {
    for await (const parte of createReadStream(caminho, { highWaterMark: TAMANHO_PEDACO })) {
      decodificador.decode(parte as Buffer, { stream: true });
    }
    decodificador.decode();
    return true;
  } catch {
    return false;
  }
}

async function ehZip(caminho: string): Promise<boolean> {
  const arquivo = await open(caminho, 'r');
  try {
    const cabecalho = Buffer.alloc(4);
    const { bytesRead } = await arquivo.read(cabecalho, 0, 4, 0);
    return bytesRead === 4 && cabecalho.readUInt32LE(0) === 0x04034b50;
  } finally {
    await arquivo.close();
  }
}

function valorDoJson(valor: unknown): ValorLido {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === 'object' && valor !== null && '$base64' in valor) {
    return Buffer.from(String((valor as { $base64: string }).$base64), 'base64');
  }
  if (typeof valor === 'boolean') return valor ? '1' : '0';
  if (typeof valor === 'object') return JSON.stringify(valor);
  return String(valor);
}

async function* eventosDoJson(entradas: EntradaLida[]): AsyncGenerator<EventoSql> {
  for (const entrada of entradas) {
    const conteudo = JSON.parse(entrada.conteudo.toString('utf8')) as {
      tabela: string;
      colunas: string[];
      linhas: Array<Record<string, unknown>>;
    };
    yield { tipo: 'criar', tabela: conteudo.tabela, colunas: conteudo.colunas };
    for (let i = 0; i < conteudo.linhas.length; i += 500) {
      yield {
        tipo: 'inserir',
        tabela: conteudo.tabela,
        colunas: conteudo.colunas,
        linhas: conteudo.linhas.slice(i, i + 500).map((linha) => conteudo.colunas.map((c) => valorDoJson(linha[c]))),
      };
    }
  }
}

export async function abrirFonte(caminho: string): Promise<FonteImportacao> {
  if (await ehZip(caminho)) {
    const entradas = lerZip(await readFile(caminho));
    const bruto = entradas.get('metadados.json');
    if (!bruto) throw new Error('O ZIP não é um backup do Atrativa Shore (metadados.json ausente)');
    let metadados: Record<string, unknown>;
    try {
      metadados = JSON.parse(bruto.conteudo.toString('utf8')) as Record<string, unknown>;
    } catch {
      throw new Error('metadados.json do backup está corrompido');
    }
    if (metadados.formato === 'atrativa-shore-backup-plataforma') {
      throw new Error('Este é um backup global da plataforma; aqui só é possível carregar backups de empresa');
    }
    if (metadados.formato !== 'atrativa-shore-backup-empresa') throw new Error('O ZIP não é um backup de empresa do Atrativa Shore');
    const empresa = metadados.empresa as { id?: number; nome?: string } | undefined;
    const origem: MetadadosOrigem = {
      formato: String(metadados.formato),
      versaoFormato: Number(metadados.versaoFormato ?? 0),
      geradoEm: typeof metadados.geradoEm === 'string' ? metadados.geradoEm : null,
      empresa: empresa?.id ? { id: Number(empresa.id), nome: String(empresa.nome ?? '') } : null,
    };
    const sql = entradas.get('dados/empresa.sql');
    if (sql) {
      const texto = sql.conteudo.toString('utf8');
      entradas.clear();
      return { origem: 'BACKUP_ATRATIVA', codificacao: 'utf8', metadados: origem, eventos: () => lerEventosSql(emPedacos(texto)) };
    }
    const tabelasJson = [...entradas.values()]
      .filter((e) => e.nome.startsWith('dados/empresa/') && e.nome.endsWith('.json'))
      .sort((a, b) => a.nome.localeCompare(b.nome));
    if (!tabelasJson.length) throw new Error('O backup não contém os dados da empresa (dados/empresa.sql)');
    return { origem: 'BACKUP_ATRATIVA', codificacao: 'utf8', metadados: origem, eventos: () => eventosDoJson(tabelasJson) };
  }

  const codificacao = (await ehUtf8(caminho)) ? 'utf8' : 'latin1';
  return {
    origem: 'DUMP_SQL',
    codificacao,
    metadados: null,
    eventos: () => lerEventosSql(createReadStream(caminho, { encoding: codificacao, highWaterMark: TAMANHO_PEDACO })),
  };
}
