import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { QueryRunner } from 'typeorm';
import { TABELAS_EMPRESA } from '../tenancy/modelo/estrutura-empresa.js';
import { abrirFonte, type FonteImportacao } from './fonte-importacao.js';
import { aplicar, analisar, type EsquemaEmpresa } from './importador.js';
import { interpretarInstrucao } from './leitor-sql.js';

function esquemaAtual(): EsquemaEmpresa {
  const esquema: EsquemaEmpresa = new Map();
  for (const ddl of TABELAS_EMPRESA) {
    const evento = interpretarInstrucao(ddl);
    if (evento?.tipo !== 'criar') continue;
    const innodb = ['cad_produtos', 'mv_estoque', 'mv_estoque_historico', 'mv_vendas', 'mv_vendas_movimento', 'mv_financeiro'];
    esquema.set(evento.tabela, { nome: evento.tabela, colunas: evento.colunas, motor: innodb.includes(evento.tabela) ? 'InnoDB' : 'MyISAM' });
  }
  esquema.get('mv_vendas')!.colunas.push('vr_pix');
  esquema.get('cad_clientes')!.colunas.push('limite_carne');
  esquema.set('api_credencial', { nome: 'api_credencial', colunas: ['id_login', 'senha_hash', 'atualizado_em'], motor: 'InnoDB' });
  esquema.set('api_migrations', { nome: 'api_migrations', colunas: ['id', 'timestamp', 'name'], motor: 'InnoDB' });
  return esquema;
}

const DUMP_LEGADO = `-- MySQL dump 8.19
-- Server version	4.0.1-alpha-max

DROP TABLE IF EXISTS cad_cartoes;
CREATE TABLE cad_cartoes (
  id tinyint(3) unsigned NOT NULL auto_increment,
  nome_cartao varchar(30) NOT NULL default '',
  porc_sobre_venda decimal(10,2) NOT NULL default '0.00',
  PRIMARY KEY  (id)
) TYPE=MyISAM;

DROP TABLE IF EXISTS cad_clientes;
CREATE TABLE cad_clientes (
  id int(8) unsigned NOT NULL auto_increment,
  nome_cliente varchar(60) default NULL,
  endereco varchar(50) default NULL,
  bairro varchar(30) default NULL,
  cidade varchar(30) default NULL,
  uf char(2) default NULL,
  telefone varchar(15) default NULL,
  celular varchar(15) default NULL,
  email varchar(100) default NULL,
  cpf varchar(18) default NULL,
  cep varchar(15) default NULL,
  cod_barra varchar(13) default NULL,
  dataniver date default NULL,
  rg varchar(16) default NULL,
  inf_adicional varchar(255) default NULL,
  faixasalarial float(10,2) default NULL,
  ie varchar(16) default NULL,
  PRIMARY KEY  (id)
) TYPE=MyISAM;
LOCK TABLES cad_clientes WRITE;
INSERT INTO cad_clientes VALUES (1,'MARIA TESTE',NULL,NULL,'AVARÉ','SP','14999990000',NULL,NULL,'11111111111',NULL,'1000000000016',NULL,NULL,NULL,1500.00,NULL),(2,'JOSE TESTE',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'1000000000023','0000-00-00',NULL,NULL,NULL,NULL);
UNLOCK TABLES;

DROP TABLE IF EXISTS cad_empresa;
CREATE TABLE cad_empresa (
  id int(8) unsigned NOT NULL auto_increment,
  nome_empresa varchar(60) default NULL,
  chave_liberacao varchar(21) default NULL,
  PRIMARY KEY  (id)
) TYPE=MyISAM;
INSERT INTO cad_empresa VALUES (1,'LOJA ANTIGA','00000SP00001D0CMY0011');

DROP TABLE IF EXISTS cad_login;
CREATE TABLE cad_login (
  id int(8) unsigned NOT NULL auto_increment,
  login varchar(15) default NULL,
  senha varchar(6) default NULL,
  id_perfil int(8) unsigned NOT NULL default '1',
  autoriza char(1) default NULL,
  PRIMARY KEY  (id)
) TYPE=MyISAM;
INSERT INTO cad_login VALUES (1,'ATRATIVA','202020',1,'S'),(2,'CAIXA','111111',2,'N');

DROP TABLE IF EXISTS cad_login_perfil;
CREATE TABLE cad_login_perfil (
  id_perfil int(8) unsigned NOT NULL auto_increment,
  nome_perfil varchar(30) default NULL,
  menu_options varchar(250) default NULL,
  PRIMARY KEY  (id_perfil)
) TYPE=MyISAM;
INSERT INTO cad_login_perfil VALUES (1,'ADMINISTRADOR','SSSS'),(2,'VENDEDOR','SNNN');

DROP TABLE IF EXISTS api_credencial;
CREATE TABLE api_credencial (id_login int, senha_hash varchar(100));
INSERT INTO api_credencial VALUES (1,'$2b$10$hashquenaopodeentrar');

DROP TABLE IF EXISTS tabela_que_nao_existe_mais;
CREATE TABLE tabela_que_nao_existe_mais (id int);
INSERT INTO tabela_que_nao_existe_mais VALUES (1),(2);

DROP TABLE IF EXISTS mv_vendas;
CREATE TABLE mv_vendas (
  id int(8) unsigned NOT NULL auto_increment,
  controle varchar(14) default NULL,
  data_venda date default NULL,
  id_cliente int(8) unsigned default NULL,
  coluna_removida int default NULL,
  PRIMARY KEY  (id)
) TYPE=MyISAM;
INSERT INTO mv_vendas VALUES (1,'20200916134230','2020-09-16',1,9),(2,'20200916140000','2020-09-16',NULL,9);
`;

function fonteDeTexto(texto: string): Promise<{ fonte: FonteImportacao; limpar: () => Promise<void> }> {
  return (async () => {
    const pasta = await mkdtemp(path.join(os.tmpdir(), 'importador-'));
    const arquivo = path.join(pasta, 'antigo.sql');
    await writeFile(arquivo, Buffer.from(texto, 'latin1'));
    return { fonte: await abrirFonte(arquivo), limpar: () => rm(pasta, { recursive: true, force: true }) };
  })();
}

function executorFalso(atuais: Record<string, Array<Record<string, unknown>>> = {}) {
  const comandos: Array<{ sql: string; parametros?: unknown[] }> = [];
  const executor = {
    query: async (sql: string, parametros?: unknown[]) => {
      comandos.push({ sql, parametros });
      const m = /^SELECT id, (.+) FROM `(\w+)`$/.exec(sql);
      if (m) return atuais[m[2]] ?? [];
      return [];
    },
  } as unknown as QueryRunner;
  return { executor, comandos };
}

describe('importador', () => {
  it('analisa o dump do sistema antigo contra o banco atual', async () => {
    const { fonte, limpar } = await fonteDeTexto(DUMP_LEGADO);
    try {
      expect(fonte.origem).toBe('DUMP_SQL');
      expect(fonte.codificacao).toBe('latin1');
      const analise = await analisar(fonte, esquemaAtual());
      const porTabela = Object.fromEntries(analise.tabelas.map((t) => [t.tabela, t]));
      expect(porTabela.cad_cartoes).toMatchObject({ acao: 'SUBSTITUIR', registros: 0 });
      expect(porTabela.cad_clientes).toMatchObject({ acao: 'SUBSTITUIR', registros: 2, colunasSemValor: ['limite_carne'], transacional: false });
      expect(porTabela.mv_vendas).toMatchObject({ acao: 'SUBSTITUIR', registros: 2, colunasIgnoradas: ['coluna_removida'], transacional: true });
      expect(porTabela.mv_vendas.colunasSemValor).toContain('vr_pix');
      expect(porTabela.api_credencial).toMatchObject({ acao: 'IGNORAR' });
      expect(porTabela.tabela_que_nao_existe_mais).toMatchObject({ acao: 'IGNORAR', motivo: 'Tabela não existe no sistema atual' });
      expect(analise.registros).toBe(2 + 1 + 2 + 2 + 2);
      expect(analise.usuariosLegados).toEqual([
        { id: 1, login: 'ATRATIVA', perfil: 'ADMINISTRADOR' },
        { id: 2, login: 'CAIXA', perfil: 'VENDEDOR' },
      ]);
      expect(analise.avisos.join(' ')).toMatch(/tabela_que_nao_existe_mais/);
      expect(analise.avisos.join(' ')).toMatch(/Latin-1/);
      expect(analise.avisos.join(' ')).toMatch(/senhas do sistema anterior/);
    } finally {
      await limpar();
    }
  });

  it('substitui as tabelas com INSERT parametrizado, sem senhas e sem tocar nas tabelas protegidas', async () => {
    const { fonte, limpar } = await fonteDeTexto(DUMP_LEGADO);
    try {
      const { executor, comandos } = executorFalso({ cad_empresa: [{ id: 1, chave_liberacao: 'CHAVE-ATUAL' }] });
      const resultado = await aplicar(executor, fonte, esquemaAtual(), () => undefined);
      const sqls = comandos.map((c) => c.sql);
      expect(sqls.filter((s) => s.startsWith('DELETE'))).toEqual([
        'DELETE FROM `cad_cartoes`',
        'DELETE FROM `cad_clientes`',
        'DELETE FROM `cad_empresa`',
        'DELETE FROM `cad_login`',
        'DELETE FROM `cad_login_perfil`',
        'DELETE FROM `mv_vendas`',
      ]);
      expect(sqls.some((s) => /api_credencial|tabela_que_nao_existe_mais|DROP/.test(s))).toBe(false);

      const login = comandos.find((c) => c.sql.startsWith('INSERT INTO `cad_login` '))!;
      expect(login.sql).toBe('INSERT INTO `cad_login` (`id`, `login`, `senha`, `id_perfil`, `autoriza`) VALUES (?,?,?,?,?),(?,?,?,?,?)');
      expect(login.parametros).toEqual(['1', 'ATRATIVA', null, '1', 'S', '2', 'CAIXA', null, '2', 'N']);

      const vendas = comandos.find((c) => c.sql.startsWith('INSERT INTO `mv_vendas`'))!;
      expect(vendas.sql).toContain('(`id`, `controle`, `data_venda`, `id_cliente`) VALUES');
      const clientes = comandos.find((c) => c.sql.startsWith('INSERT INTO `cad_clientes`'))!;
      expect(clientes.parametros).toContain('AVARÉ');
      expect(clientes.parametros).toContain('0000-00-00');

      expect(resultado.tabelas).toEqual(
        expect.arrayContaining([
          { tabela: 'cad_cartoes', registros: 0 },
          { tabela: 'cad_clientes', registros: 2 },
          { tabela: 'mv_vendas', registros: 2 },
        ]),
      );
      expect(resultado.registros).toBe(9);
    } finally {
      await limpar();
    }
  });

  it('mantém a chave de liberação atual quando o backup a traz vazia', async () => {
    const dump = "CREATE TABLE `cad_empresa` (`id` int, `nome_empresa` varchar(60), `chave_liberacao` varchar(21));\nINSERT INTO `cad_empresa` (`id`, `nome_empresa`, `chave_liberacao`) VALUES (1,'LOJA',NULL);";
    const { fonte, limpar } = await fonteDeTexto(dump);
    try {
      const { executor, comandos } = executorFalso({ cad_empresa: [{ id: 1, chave_liberacao: 'CHAVE-ATUAL' }] });
      await aplicar(executor, fonte, esquemaAtual(), () => undefined);
      expect(comandos.at(-1)).toEqual({
        sql: 'UPDATE `cad_empresa` SET `chave_liberacao` = ? WHERE id = ? AND `chave_liberacao` IS NULL',
        parametros: ['CHAVE-ATUAL', 1],
      });
    } finally {
      await limpar();
    }
  });

  it('recusa arquivo com linha de tamanho diferente da tabela e arquivo sem tabelas', async () => {
    const quebrado = await fonteDeTexto('CREATE TABLE cad_login (id int, login varchar(15));\nINSERT INTO cad_login VALUES (1,"A",3);');
    await expect(analisar(quebrado.fonte, esquemaAtual())).rejects.toThrow(/cad_login: uma linha tem 3 valores, mas a tabela tem 2 colunas/);
    await quebrado.limpar();
    const vazio = await fonteDeTexto('SELECT 1;\nDROP DATABASE outra;');
    await expect(analisar(vazio.fonte, esquemaAtual())).rejects.toThrow(/Nenhuma tabela/);
    await vazio.limpar();
    const estranho = await fonteDeTexto('CREATE TABLE outra_coisa (id int);\nINSERT INTO outra_coisa VALUES (1);');
    await expect(analisar(estranho.fonte, esquemaAtual())).rejects.toThrow(/Nenhuma tabela do arquivo corresponde/);
    await estranho.limpar();
  });
});
