import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import type { DataSource } from 'typeorm';
import {
  RODAPE_SQL,
  cabecalhoSql,
  comSnapshot,
  dumpTabelas,
  executarMysqldump,
  identificador,
  tabelasDoBanco,
  type ConexaoMysql,
} from './sql.js';
import type { EscritorZip } from './zip.js';

export { valorSql } from './sql.js';
export type { ConexaoMysql } from './sql.js';

export const FORMATO_PLATAFORMA = 'atrativa-shore-backup-plataforma';
export const VERSAO_FORMATO_PLATAFORMA = 1;

export const TABELAS_SEM_DADOS = ['plataforma_refresh_tokens'];

export interface BancoParaDump {
  banco: string;
  fonte: DataSource;
  idEmpresa: number | null;
  nomeEmpresa: string | null;
}

export interface ResumoBanco {
  banco: string;
  arquivo: string;
  idEmpresa: number | null;
  tabelas: number;
  registros: number;
}

async function* juntar(...partes: Array<string | AsyncIterable<string | Buffer>>): AsyncGenerator<string | Buffer> {
  for (const parte of partes) {
    if (typeof parte === 'string') yield parte;
    else for await (const pedaco of parte) yield pedaco;
  }
}

export async function exportarBancoSql(
  alvo: BancoParaDump,
  zip: EscritorZip,
  aoContar: (linhas: number) => void,
  aoTrocarTabela: (tabela: string) => void | Promise<void>,
): Promise<ResumoBanco> {
  identificador(alvo.banco);
  return comSnapshot(alvo.fonte, async (executor) => {
    const tabelas = await tabelasDoBanco(executor);
    let registros = 0;
    const arquivo = `sql/${alvo.banco}.sql`;
    await zip.adicionar(
      arquivo,
      juntar(
        cabecalhoSql(`banco ${alvo.banco}`, alvo.banco),
        dumpTabelas(executor, tabelas, { semDados: TABELAS_SEM_DADOS }, (tabela, linhas) => {
          if (linhas === 0) void aoTrocarTabela(tabela);
          registros += linhas;
          aoContar(linhas);
        }),
        RODAPE_SQL,
      ),
    );
    return { banco: alvo.banco, arquivo, idEmpresa: alvo.idEmpresa, tabelas: tabelas.length, registros };
  });
}

export async function contarRegistros(fonte: DataSource): Promise<number> {
  const linhas = (await fonte.query(
    "SELECT COALESCE(SUM(TABLE_ROWS), 0) AS total FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'",
  )) as Array<{ total: number | string }>;
  return Number(linhas[0]?.total ?? 0);
}

function validarBanco(banco: string): string {
  identificador(banco);
  return banco;
}

export async function exportarComMysqldump(
  executavel: string,
  conexao: ConexaoMysql,
  bancos: string[],
  ignorar: string[],
  zip: EscritorZip,
  pastaTemporaria: string,
  aoEscrever: (bytes: number) => void = () => undefined,
): Promise<{ arquivo: string; bytes: number }> {
  const temporario = path.join(pastaTemporaria, `${randomUUID()}.sql.parcial`);
  try {
    await executarMysqldump(
      executavel,
      conexao,
      ['--routines', '--triggers', ...ignorar.map((tabela) => `--ignore-table=${tabela}`), '--databases', ...bancos.map(validarBanco)],
      temporario,
      aoEscrever,
    );
    const arquivo = 'sql/plataforma-completa.sql';
    const { original } = await zip.adicionar(arquivo, createReadStream(temporario));
    return { arquivo, bytes: original };
  } finally {
    await rm(temporario, { force: true }).catch(() => undefined);
  }
}
