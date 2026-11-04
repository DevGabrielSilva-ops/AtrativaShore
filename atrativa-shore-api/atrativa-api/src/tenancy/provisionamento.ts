import { randomInt } from 'node:crypto';
import { DataSource, type EntityManager, type QueryRunner } from 'typeorm';
import type { Configuracao } from '../config/configuracao.js';
import { opcoesBancoEmpresa, opcoesServidor } from '../database/opcoes-banco.js';
import { DADOS_BASE_EMPRESA, TABELAS_EMPRESA } from './modelo/estrutura-empresa.js';

export interface DadosCadastroEmpresa {
  nome: string;
  cnpj?: string | null;
  telefone?: string | null;
  email?: string | null;
  endereco?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  cep?: string | null;
}

export const PERFIL_ACESSO_WEB = 'ACESSO WEB';

export function nomeBancoValido(nome: string): boolean {
  return /^[A-Za-z0-9_]{1,64}$/.test(nome);
}

export async function bancoExiste(servidor: DataSource, banco: string): Promise<{ existe: boolean; tabelas: number }> {
  const [schema] = (await servidor.query('SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?', [
    banco,
  ])) as unknown[];
  if (!schema) return { existe: false, tabelas: 0 };
  const [{ total }] = (await servidor.query(
    'SELECT COUNT(*) AS total FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?',
    [banco],
  )) as Array<{ total: number | string }>;
  return { existe: true, tabelas: Number(total) };
}

async function executarEstrutura(executor: QueryRunner, dados: DadosCadastroEmpresa): Promise<void> {
  await executor.query("SET SESSION sql_mode = ''");
  for (const sql of TABELAS_EMPRESA) await executor.query(sql);
  for (const sql of DADOS_BASE_EMPRESA) await executor.query(sql);
  await executor.query(
    `INSERT INTO cad_empresa (id, nome_empresa, endereco, bairro, cidade, uf, cep, cnpj, telefone, email, qtd_terminal, qtd_turnos)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, '1')`,
    [
      dados.nome.slice(0, 100),
      dados.endereco?.slice(0, 100) ?? null,
      dados.bairro?.slice(0, 200) ?? null,
      dados.cidade?.slice(0, 30) ?? null,
      dados.uf?.slice(0, 2) ?? null,
      dados.cep?.slice(0, 15) ?? null,
      dados.cnpj?.slice(0, 18) ?? null,
      dados.telefone?.slice(0, 15) ?? null,
      dados.email?.slice(0, 200) ?? null,
    ],
  );
  await executor.query("INSERT INTO cad_produtos_tipo (id, nome_tipo) VALUES (1, 'GERAL')");
  await executor.query(
    `INSERT INTO cad_produtos (nome_produto, vr_compra, vr_venda, modo_estoque, id_tipo, impostos, vr_venda_2, grade)
     VALUES ('RECEBIMENTO DE CARNÊ', NULL, NULL, 6, 1, 0, 0, 0)`,
  );
}

export async function provisionarBancoEmpresa(
  config: Configuracao,
  banco: string,
  dados: DadosCadastroEmpresa,
): Promise<void> {
  if (!nomeBancoValido(banco)) throw new Error(`Nome de banco inválido: ${banco}`);
  const servidor = new DataSource(opcoesServidor(config));
  await servidor.initialize();
  try {
    const estado = await bancoExiste(servidor, banco);
    if (estado.tabelas > 0) throw new Error(`O banco ${banco} já existe e não está vazio`);
    if (!estado.existe) await servidor.query(`CREATE DATABASE \`${banco}\` CHARACTER SET latin1`);
  } finally {
    await servidor.destroy();
  }

  const fonte = new DataSource(opcoesBancoEmpresa(config, banco));
  await fonte.initialize();
  try {
    const executor = fonte.createQueryRunner();
    try {
      await executarEstrutura(executor, dados);
    } finally {
      await executor.release();
    }
    await fonte.runMigrations({ transaction: 'each' });
  } finally {
    await fonte.destroy();
  }
}

export async function migrarBancoEmpresa(config: Configuracao, banco: string): Promise<string[]> {
  const fonte = new DataSource(opcoesBancoEmpresa(config, banco));
  await fonte.initialize();
  try {
    const aplicadas = await fonte.runMigrations({ transaction: 'each' });
    return aplicadas.map((m) => m.name);
  } finally {
    await fonte.destroy();
  }
}

const ALFABETO_LOGIN = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function senhaAleatoriaLegada(): string {
  return Array.from({ length: 6 }, () => ALFABETO_LOGIN[randomInt(ALFABETO_LOGIN.length)]).join('');
}

function baseDoLogin(texto: string): string {
  const limpo = texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  return (limpo || 'USUARIO').slice(0, 12);
}

export async function criarLoginEspelho(executor: DataSource | EntityManager, referencia: string): Promise<number> {
  const [perfilExistente] = (await executor.query('SELECT id_perfil FROM cad_login_perfil WHERE nome_perfil = ?', [
    PERFIL_ACESSO_WEB,
  ])) as Array<{ id_perfil: number }>;
  let idPerfil = perfilExistente?.id_perfil;
  if (!idPerfil) {
    const [admin] = (await executor.query(
      'SELECT LENGTH(menu_options) AS tamanho FROM cad_login_perfil ORDER BY id_perfil LIMIT 1',
    )) as Array<{ tamanho: number | null }>;
    const resultado = (await executor.query('INSERT INTO cad_login_perfil (nome_perfil, menu_options) VALUES (?, ?)', [
      PERFIL_ACESSO_WEB,
      'N'.repeat(Math.min(250, Number(admin?.tamanho ?? 250) || 250)),
    ])) as { insertId: number };
    idPerfil = resultado.insertId;
  }

  const base = baseDoLogin(referencia);
  for (let tentativa = 0; tentativa < 1000; tentativa += 1) {
    const login = tentativa === 0 ? base : `${base}${tentativa + 1}`.slice(-15);
    const [ocupado] = (await executor.query('SELECT id FROM cad_login WHERE login = ?', [login])) as unknown[];
    if (ocupado) continue;
    const resultado = (await executor.query(
      "INSERT INTO cad_login (login, senha, id_perfil, autoriza) VALUES (?, ?, ?, 'N')",
      [login, senhaAleatoriaLegada(), idPerfil],
    )) as { insertId: number };
    return resultado.insertId;
  }
  throw new Error('Não foi possível gerar um login legado único');
}
