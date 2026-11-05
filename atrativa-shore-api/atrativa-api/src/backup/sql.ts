import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { finished } from 'node:stream/promises';
import mysql from 'mysql2';
import type { DataSource, QueryRunner } from 'typeorm';

const TAMANHO_LOTE = 1000;
const LINHAS_POR_INSERT = 200;

export interface ConexaoMysql {
  host: string;
  porta: number;
  usuario: string;
  senha: string;
}

export interface OpcoesDump {
  semDados?: string[];
  mascarar?: Record<string, string[]>;
  criarBanco?: string | null;
  seCriarTabela?: boolean;
}

type Executor = { query: (sql: string) => Promise<unknown> };

export function identificador(nome: string): string {
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

export function cabecalhoSql(titulo: string, banco: string | null): string {
  return [
    `-- Atrativa Shore SQL dump: ${titulo}`,
    `-- Gerado em ${new Date().toISOString()}`,
    '-- Restauração: importe num banco vazio (mysql -u <usuario> -p <banco> < arquivo.sql). Nenhuma tabela existente é apagada.',
    '',
    '/*!40101 SET NAMES utf8mb4 */;',
    '/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;',
    "/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;",
    ...(banco ? [`CREATE DATABASE IF NOT EXISTS ${identificador(banco)} DEFAULT CHARACTER SET utf8mb4;`, `USE ${identificador(banco)};`] : []),
    '',
    '',
  ].join('\n');
}

export const RODAPE_SQL = [
  '/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;',
  '/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;',
  '',
].join('\n');

export async function tabelasDoBanco(executor: Executor): Promise<string[]> {
  return (
    (await executor.query(
      "SELECT TABLE_NAME AS nome FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME",
    )) as Array<{ nome: string }>
  ).map((t) => t.nome);
}

export function insercoes(tabela: string, linhas: Array<Record<string, unknown>>, mascarar: string[] = []): string {
  if (!linhas.length) return '';
  const colunas = Object.keys(linhas[0]);
  const partes: string[] = [];
  for (let i = 0; i < linhas.length; i += LINHAS_POR_INSERT) {
    const valores = linhas
      .slice(i, i + LINHAS_POR_INSERT)
      .map((linha) => `(${colunas.map((c) => (mascarar.includes(c) ? 'NULL' : valorSql(linha[c]))).join(',')})`)
      .join(',\n');
    partes.push(`INSERT INTO ${identificador(tabela)} (${colunas.map(identificador).join(', ')}) VALUES\n${valores};\n`);
  }
  return partes.join('');
}

export async function criacaoDaTabela(executor: Executor, tabela: string, seNaoExistir = false): Promise<string> {
  const [criacao] = (await executor.query(`SHOW CREATE TABLE ${identificador(tabela)}`)) as Array<Record<string, string>>;
  const sql = criacao['Create Table'];
  return seNaoExistir ? sql.replace(/^CREATE TABLE /, 'CREATE TABLE IF NOT EXISTS ') : sql;
}

export async function* dumpTabelas(
  executor: Executor,
  tabelas: string[],
  opcoes: OpcoesDump,
  aoContar: (tabela: string, linhas: number) => void,
): AsyncGenerator<string> {
  for (const tabela of tabelas) {
    yield `--\n-- Tabela ${identificador(tabela)}\n--\n\n`;
    yield `${await criacaoDaTabela(executor, tabela, opcoes.seCriarTabela)};\n\n`;
    if (opcoes.semDados?.includes(tabela)) {
      yield `-- ${tabela}: dados não incluídos por conterem credenciais de acesso\n\n`;
      aoContar(tabela, 0);
      continue;
    }
    const mascarar = opcoes.mascarar?.[tabela] ?? [];
    if (mascarar.length) yield `-- ${tabela}: colunas ${mascarar.join(', ')} exportadas como NULL (credenciais)\n`;
    const chave = (
      (await executor.query(`SHOW KEYS FROM ${identificador(tabela)} WHERE Key_name = 'PRIMARY'`)) as Array<{
        Column_name: string;
        Seq_in_index: number;
      }>
    )
      .sort((a, b) => a.Seq_in_index - b.Seq_in_index)
      .map((k) => identificador(k.Column_name));
    const ordem = chave.length ? ` ORDER BY ${chave.join(', ')}` : '';
    aoContar(tabela, 0);
    for (let deslocamento = 0; ; deslocamento += TAMANHO_LOTE) {
      const linhas = (await executor.query(
        `SELECT * FROM ${identificador(tabela)}${ordem} LIMIT ${TAMANHO_LOTE} OFFSET ${deslocamento}`,
      )) as Array<Record<string, unknown>>;
      const texto = insercoes(tabela, linhas, mascarar);
      if (texto) yield texto;
      aoContar(tabela, linhas.length);
      if (linhas.length < TAMANHO_LOTE) break;
      if (!chave.length) throw new Error(`Tabela ${tabela} sem chave primária e com mais de ${TAMANHO_LOTE} linhas`);
    }
    yield '\n';
  }
}

export async function comSnapshot<T>(fonte: DataSource, acao: (executor: QueryRunner) => Promise<T>): Promise<T> {
  const executor = fonte.createQueryRunner();
  await executor.connect();
  try {
    await executor.query('SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    await executor.query('START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY');
    return await acao(executor);
  } finally {
    await executor.query('ROLLBACK').catch(() => undefined);
    await executor.release();
  }
}

export function mysqldumpDisponivel(executavel: string): Promise<string | null> {
  return new Promise((resolver) => {
    let saida = '';
    try {
      const processo = spawn(executavel, ['--version'], { stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true });
      processo.stdout.on('data', (parte: Buffer) => (saida += parte.toString('utf8')));
      processo.once('error', () => resolver(null));
      processo.once('close', (codigo) => resolver(codigo === 0 ? saida.trim().slice(0, 120) || executavel : null));
    } catch {
      resolver(null);
    }
  });
}

function valorDeOpcao(valor: string): string {
  return `"${valor.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

export async function executarMysqldump(
  executavel: string,
  conexao: ConexaoMysql,
  argumentos: string[],
  destino: string,
  aoEscrever: (bytes: number) => void,
): Promise<void> {
  const opcoes = path.join(os.tmpdir(), `atrativa-mysqldump-${randomUUID()}.cnf`);
  await writeFile(
    opcoes,
    `[client]\nhost=${valorDeOpcao(conexao.host)}\nport=${conexao.porta}\nuser=${valorDeOpcao(conexao.usuario)}\npassword=${valorDeOpcao(conexao.senha)}\n`,
    { mode: 0o600 },
  );
  try {
    await new Promise<void>((resolver, rejeitar) => {
      const processo = spawn(
        executavel,
        [
          `--defaults-extra-file=${opcoes}`,
          '--single-transaction',
          '--quick',
          '--hex-blob',
          '--no-tablespaces',
          '--skip-add-drop-table',
          '--default-character-set=utf8mb4',
          ...argumentos,
        ],
        { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true },
      );
      const arquivo = createWriteStream(destino, { mode: 0o600 });
      const erros: Buffer[] = [];
      let total = 0;
      processo.stdout.on('data', (parte: Buffer) => {
        total += parte.length;
        aoEscrever(total);
      });
      processo.stdout.pipe(arquivo);
      processo.stderr.on('data', (parte: Buffer) => {
        if (erros.reduce((a, b) => a + b.length, 0) < 8000) erros.push(parte);
      });
      const arquivoPronto = finished(arquivo);
      arquivoPronto.catch(() => undefined);
      processo.once('error', rejeitar);
      processo.once('close', (codigo) => {
        arquivoPronto.then(() => {
          if (codigo === 0) return resolver();
          const mensagem = Buffer.concat(erros)
            .toString('utf8')
            .split('\n')
            .filter((linha) => !/Using a password/i.test(linha))
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
          rejeitar(new Error(`mysqldump terminou com código ${codigo}${mensagem ? `: ${mensagem.slice(0, 200)}` : ''}`));
        }, rejeitar);
      });
    });
  } finally {
    await rm(opcoes, { force: true }).catch(() => undefined);
  }
}
