import { spawn } from 'node:child_process';
import mysql from 'mysql2';
import type { DataSource, QueryRunner } from 'typeorm';
import type { Progresso } from './exportador-empresa.js';
import type { EscritorZip } from './zip.js';

export const FORMATO_PLATAFORMA = 'atrativa-shore-backup-plataforma';
export const VERSAO_FORMATO_PLATAFORMA = 1;

export const TABELAS_SEM_DADOS = ['plataforma_refresh_tokens'];

const TAMANHO_LOTE = 1000;
const LINHAS_POR_INSERT = 200;

export interface BancoParaDump {
  banco: string;
  fonte: DataSource;
  idEmpresa: number | null;
  nomeEmpresa: string | null;
}

export interface ConexaoMysql {
  host: string;
  porta: number;
  usuario: string;
  senha: string;
}

export interface ResumoBanco {
  banco: string;
  arquivo: string;
  idEmpresa: number | null;
  tabelas: number;
  registros: number;
}

function identificador(nome: string): string {
  if (!/^[A-Za-z0-9_$]+$/.test(nome)) throw new Error(`Nome inválido no banco: ${nome}`);
  return `\`${nome}\``;
}

export function valorSql(valor: unknown): string {
  if (valor === null || valor === undefined) return 'NULL';
  if (Buffer.isBuffer(valor)) return valor.length ? `0x${valor.toString('hex')}` : "''";
  if (typeof valor === 'number') return Number.isFinite(valor) ? String(valor) : 'NULL';
  if (typeof valor === 'bigint') return valor.toString();
  if (typeof valor === 'boolean') return valor ? '1' : '0';
  if (valor instanceof Date) return mysql.escape(valor.toISOString().slice(0, 19).replace('T', ' '));
  if (typeof valor === 'object') return mysql.escape(JSON.stringify(valor));
  return mysql.escape(String(valor));
}

async function* dumpBanco(
  executor: QueryRunner,
  banco: string,
  tabelas: string[],
  aoContar: (tabela: string, linhas: number) => void,
): AsyncGenerator<string> {
  yield [
    `-- Atrativa Shore: banco ${banco}`,
    '-- Restauração: crie o banco vazio e importe este arquivo. Nenhuma tabela existente é apagada.',
    'SET NAMES utf8mb4;',
    'SET FOREIGN_KEY_CHECKS = 0;',
    "SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';",
    `CREATE DATABASE IF NOT EXISTS ${identificador(banco)} DEFAULT CHARACTER SET utf8mb4;`,
    `USE ${identificador(banco)};`,
    '',
    '',
  ].join('\n');
  for (const tabela of tabelas) {
    const [criacao] = (await executor.query(`SHOW CREATE TABLE ${identificador(tabela)}`)) as Array<Record<string, string>>;
    yield `${criacao['Create Table']};\n\n`;
    if (TABELAS_SEM_DADOS.includes(tabela)) {
      yield `-- ${tabela}: dados não incluídos (sessões de acesso)\n\n`;
      continue;
    }
    const chave = (
      (await executor.query(`SHOW KEYS FROM ${identificador(tabela)} WHERE Key_name = 'PRIMARY'`)) as Array<{
        Column_name: string;
        Seq_in_index: number;
      }>
    )
      .sort((a, b) => a.Seq_in_index - b.Seq_in_index)
      .map((k) => identificador(k.Column_name));
    const ordem = chave.length ? ` ORDER BY ${chave.join(', ')}` : '';
    let colunas: string | null = null;
    for (let deslocamento = 0; ; deslocamento += TAMANHO_LOTE) {
      const linhas = (await executor.query(
        `SELECT * FROM ${identificador(tabela)}${ordem} LIMIT ${TAMANHO_LOTE} OFFSET ${deslocamento}`,
      )) as Array<Record<string, unknown>>;
      if (linhas.length && colunas === null) colunas = Object.keys(linhas[0]).map(identificador).join(', ');
      for (let i = 0; i < linhas.length; i += LINHAS_POR_INSERT) {
        const grupo = linhas.slice(i, i + LINHAS_POR_INSERT);
        const valores = grupo.map((linha) => `(${Object.values(linha).map(valorSql).join(',')})`).join(',\n');
        yield `INSERT INTO ${identificador(tabela)} (${colunas}) VALUES\n${valores};\n`;
      }
      aoContar(tabela, linhas.length);
      if (linhas.length < TAMANHO_LOTE) break;
      if (!chave.length) throw new Error(`Tabela ${banco}.${tabela} sem chave primária e com mais de ${TAMANHO_LOTE} linhas`);
    }
    yield '\n';
  }
  yield 'SET FOREIGN_KEY_CHECKS = 1;\n';
}

export async function exportarBancoSql(
  alvo: BancoParaDump,
  zip: EscritorZip,
  aoContar: (linhas: number) => void,
  aoTrocarTabela: (tabela: string) => void | Promise<void>,
): Promise<ResumoBanco> {
  const executor = alvo.fonte.createQueryRunner();
  await executor.connect();
  try {
    await executor.query('SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    await executor.query('START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY');
    const tabelas = (
      (await executor.query(
        "SELECT TABLE_NAME AS nome FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME",
      )) as Array<{ nome: string }>
    ).map((t) => t.nome);
    let registros = 0;
    let atual = '';
    const arquivo = `sql/${alvo.banco}.sql`;
    await zip.adicionar(
      arquivo,
      dumpBanco(executor, alvo.banco, tabelas, (tabela, linhas) => {
        if (tabela !== atual) {
          atual = tabela;
          void aoTrocarTabela(tabela);
        }
        registros += linhas;
        aoContar(linhas);
      }),
    );
    return { banco: alvo.banco, arquivo, idEmpresa: alvo.idEmpresa, tabelas: tabelas.length, registros };
  } finally {
    await executor.query('ROLLBACK').catch(() => undefined);
    await executor.release();
  }
}

export async function contarRegistros(fonte: DataSource): Promise<number> {
  const linhas = (await fonte.query(
    "SELECT COALESCE(SUM(TABLE_ROWS), 0) AS total FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'",
  )) as Array<{ total: number | string }>;
  return Number(linhas[0]?.total ?? 0);
}

export async function exportarComMysqldump(
  executavel: string,
  conexao: ConexaoMysql,
  bancos: string[],
  ignorar: string[],
  zip: EscritorZip,
): Promise<{ arquivo: string; bytes: number }> {
  const argumentos = [
    `--host=${conexao.host}`,
    `--port=${conexao.porta}`,
    `--user=${conexao.usuario}`,
    '--single-transaction',
    '--quick',
    '--hex-blob',
    '--routines',
    '--triggers',
    '--skip-add-drop-table',
    '--default-character-set=utf8mb4',
    ...ignorar.map((tabela) => `--ignore-table=${tabela}`),
    '--databases',
    ...bancos.map((banco) => {
      identificador(banco);
      return banco;
    }),
  ];
  const processo = spawn(executavel, argumentos, {
    env: { ...process.env, MYSQL_PWD: conexao.senha },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const erros: Buffer[] = [];
  processo.stderr.on('data', (parte: Buffer) => {
    if (erros.reduce((a, b) => a + b.length, 0) < 8000) erros.push(parte);
  });
  const saida = new Promise<number>((resolver, rejeitar) => {
    processo.once('error', rejeitar);
    processo.once('close', (codigo) => resolver(codigo ?? 1));
  });
  saida.catch(() => undefined);
  const arquivo = 'sql/plataforma-completa.sql';
  const { original } = await zip.adicionar(arquivo, processo.stdout as AsyncIterable<Buffer>);
  const codigo = await saida;
  if (codigo !== 0) {
    const mensagem = Buffer.concat(erros).toString('utf8').replace(/\s+/g, ' ').trim();
    throw new Error(`mysqldump terminou com código ${codigo}${mensagem ? `: ${mensagem.slice(0, 200)}` : ''}`);
  }
  return { arquivo, bytes: original };
}
