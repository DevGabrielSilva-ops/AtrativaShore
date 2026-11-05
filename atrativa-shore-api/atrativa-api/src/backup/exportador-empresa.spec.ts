import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import type { DataSource } from 'typeorm';
import { exportarEmpresa } from './exportador-empresa.js';
import { lerZip } from './ler-zip.js';
import { mysqldumpDisponivel, valorSql } from './sql.js';
import { EscritorZip } from './zip.js';

type Linha = Record<string, unknown>;

const TABELAS: Record<string, { chave: string[]; linhas: Linha[] }> = {
  cad_empresa: {
    chave: ['id'],
    linhas: [{ id: 1, razao: 'Loja A', fantasia: "Loja d'A", chave_liberacao: 'SEGREDO-LIBERACAO' }],
  },
  cad_login: {
    chave: ['id'],
    linhas: [
      { id: 1, nome: 'Ana', usuario: 'ana', senha: '123456' },
      { id: 2, nome: 'Bia', usuario: 'bia', senha: '654321' },
    ],
  },
  api_credencial: { chave: ['id_login'], linhas: [{ id_login: 1, senha_hash: '$2b$10$hash' }] },
  cad_clientes: {
    chave: ['id'],
    linhas: Array.from({ length: 4500 }, (_, i) => ({ id: i + 1, nome: `Cliente ${i + 1}`, foto: i === 0 ? Buffer.from([1, 2, 3]) : null })),
  },
  mv_fechamento: { chave: ['id'], linhas: [{ id: 7, data: '2026-11-04', vr_total: '150.00', id_login: 1 }] },
};

function consultaComum(sql: string): unknown {
  if (sql.includes('DATA_LENGTH')) return [{ estimado: '4096' }];
  if (sql.includes('information_schema.TABLES')) return Object.keys(TABELAS).sort().map((nome) => ({ nome }));
  let m = /^SELECT COUNT\(\*\) AS total FROM `(\w+)`$/.exec(sql);
  if (m) return [{ total: String(TABELAS[m[1]].linhas.length) }];
  m = /^SHOW CREATE TABLE `(\w+)`$/.exec(sql);
  if (m) return [{ Table: m[1], 'Create Table': `CREATE TABLE \`${m[1]}\` (\n  \`id\` int NOT NULL\n) ENGINE=InnoDB` }];
  return undefined;
}

function fonteEmpresa(consultas: string[]): DataSource {
  const executor = {
    connect: async () => undefined,
    release: async () => undefined,
    query: async (sql: string): Promise<unknown> => {
      consultas.push(sql);
      if (sql.startsWith('SET') || sql.startsWith('START') || sql === 'ROLLBACK') return [];
      const comum = consultaComum(sql);
      if (comum) return comum;
      let m = /^SHOW KEYS FROM `(\w+)`/.exec(sql);
      if (m) return TABELAS[m[1]].chave.map((Column_name, i) => ({ Column_name, Seq_in_index: i + 1 }));
      m = /^SELECT \* FROM `(\w+)` ORDER BY .+ LIMIT (\d+) OFFSET (\d+)$/.exec(sql);
      if (m) return TABELAS[m[1]].linhas.slice(Number(m[3]), Number(m[3]) + Number(m[2]));
      throw new Error(`SQL inesperado no snapshot: ${sql}`);
    },
  };
  return {
    createQueryRunner: () => executor,
    query: async (sql: string) => {
      consultas.push(sql);
      const comum = consultaComum(sql);
      if (comum) return comum;
      if (sql === 'SELECT * FROM cad_empresa ORDER BY id LIMIT 1') return TABELAS.cad_empresa.linhas.slice(0, 1);
      throw new Error(`SQL inesperado: ${sql}`);
    },
  } as unknown as DataSource;
}

function fontePlataforma(parametros: unknown[][]): DataSource {
  return {
    query: async (sql: string, params?: unknown[]) => {
      const m = /^SHOW CREATE TABLE `(\w+)`$/.exec(sql);
      if (m) return [{ Table: m[1], 'Create Table': `CREATE TABLE \`${m[1]}\` (\n  \`id\` int NOT NULL\n)` }];
      parametros.push(params ?? []);
      if (sql.includes('FROM plataforma_usuarios')) {
        return [{ id: 10, id_empresa: params![0], nome: 'Admin A', email: 'a@a.com', senha_hash: '$2b$10$hashdoadmin', versao_token: 3 }];
      }
      if (sql.includes('FROM plataforma_empresas WHERE id = ?')) return [{ id: params![0], nome: 'Loja A', status: 'ACTIVE' }];
      if (sql.includes('plataforma_planos')) return [{ id: 1, nome: 'Básico' }];
      if (sql.includes('plataforma_auditoria')) return [{ id: 1, id_empresa: params![0], acao: 'caixa.fechar', detalhes: { valor: 10 } }];
      return [];
    },
  } as unknown as DataSource;
}

async function exportar(mysqldump: { executavel: string; conexao: { host: string; porta: number; usuario: string; senha: string } } | null = null) {
  const consultas: string[] = [];
  const parametros: unknown[][] = [];
  const saida = new PassThrough();
  const partes: Buffer[] = [];
  saida.on('data', (parte: Buffer) => partes.push(parte));
  const zip = new EscritorZip(saida);
  const progresso = vi.fn();
  const pasta = await mkdtemp(path.join(os.tmpdir(), 'exportador-'));
  try {
    const resultado = await exportarEmpresa(
      fonteEmpresa(consultas),
      fontePlataforma(parametros),
      zip,
      {
        idEmpresa: 3,
        nomeEmpresa: 'Loja A',
        banco: 'atrativa_emp_3',
        geradoPor: { id: 10, nome: 'Admin A' },
        geradoEm: new Date('2026-11-04T21:00:00Z'),
        versaoApi: '0.0.1',
      },
      progresso,
      { mysqldump, pastaTemporaria: pasta },
    );
    await zip.finalizar();
    const entradas = lerZip(Buffer.concat(partes));
    const texto = (nome: string) => entradas.get(nome)!.conteudo.toString('utf8');
    return { resultado, entradas, texto, consultas, parametros, progresso };
  } finally {
    await rm(pasta, { recursive: true, force: true });
  }
}

describe('exportarEmpresa', () => {
  it('gera um dump SQL do banco da empresa e dos registros dela no banco central', async () => {
    const { entradas, resultado, texto, progresso } = await exportar();
    expect([...entradas.keys()].sort()).toEqual(
      ['LEIA-ME.txt', 'dados/empresa.sql', 'dados/plataforma.sql', 'empresa.json', 'metadados.json'].sort(),
    );
    const sql = texto('dados/empresa.sql');
    for (const tabela of Object.keys(TABELAS)) expect(sql).toContain(`CREATE TABLE \`${tabela}\``);
    expect(sql).not.toMatch(/DROP TABLE|CREATE DATABASE|^USE /m);
    expect(sql).toContain('FOREIGN_KEY_CHECKS=0');
    expect(sql.match(/^\(\d+,'Cliente \d+'/gm)).toHaveLength(4500);
    expect(sql).toContain("(1,'Cliente 1',0x010203)");
    expect(sql).toContain("(7,'2026-11-04','150.00',1)");
    expect(sql).toContain("'Loja d\\'A'");

    const central = texto('dados/plataforma.sql');
    expect(central).toContain('CREATE TABLE IF NOT EXISTS `plataforma_usuarios`');
    expect(central).toContain("INSERT INTO `plataforma_usuarios` (`id`, `id_empresa`, `nome`, `email`, `senha_hash`, `versao_token`) VALUES\n(10,3,'Admin A','a@a.com',NULL,3);");
    expect(central).toContain(`'{\\"valor\\":10}'`);

    const metadados = JSON.parse(texto('metadados.json'));
    expect(metadados).toMatchObject({
      formato: 'atrativa-shore-backup-empresa',
      versaoFormato: 2,
      ferramenta: 'exportador interno (formato mysqldump)',
      empresa: { id: 3, nome: 'Loja A' },
      geradoEm: '2026-11-04T21:00:00.000Z',
    });
    expect(metadados.arquivos[0].tabelas).toEqual(expect.arrayContaining([{ tabela: 'cad_clientes', registros: 4500 }]));
    expect(resultado.registros).toBe(1 + 2 + 4500 + 1 + 1 + 1 + 1 + 1);
    expect(progresso).toHaveBeenLastCalledWith(97, 'Gravando metadados');
  });

  it('não inclui senhas, hashes nem a chave de liberação', async () => {
    const { entradas, texto } = await exportar();
    const todo = [...entradas.values()].map((e) => e.conteudo.toString('utf8')).join('\n');
    for (const segredo of ["'123456'", "'654321'", '$2b$10$hash', 'SEGREDO-LIBERACAO']) expect(todo).not.toContain(segredo);
    const sql = texto('dados/empresa.sql');
    expect(sql).toContain("(1,'Ana','ana',NULL)");
    expect(sql).toContain('CREATE TABLE `api_credencial`');
    expect(sql).not.toContain('INSERT INTO `api_credencial`');
    expect(JSON.parse(texto('empresa.json')).cadastro.chave_liberacao).toBeUndefined();
  });

  it('lê o banco da empresa num snapshot consistente e filtra o banco central pela empresa', async () => {
    const { consultas, parametros } = await exportar();
    expect(consultas).toContain('START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY');
    expect(consultas.at(-1)).toBe('ROLLBACK');
    expect(consultas.some((sql) => sql.includes('SELECT * FROM `api_credencial`'))).toBe(false);
    expect(parametros.length).toBe(6);
    for (const params of parametros) expect(params).toEqual([3]);
  });

  it('usa o exportador interno quando o mysqldump não está instalado', async () => {
    const { resultado } = await exportar({
      executavel: 'mysqldump-inexistente-atrativa',
      conexao: { host: 'localhost', porta: 3306, usuario: 'root', senha: 'x' },
    });
    expect(resultado.ferramenta).toBe('exportador interno (formato mysqldump)');
    expect(resultado.aviso).toBeNull();
  });
});

describe('SQL do backup', () => {
  it('escapa valores no padrão do MySQL', () => {
    expect(valorSql(null)).toBe('NULL');
    expect(valorSql(12.5)).toBe('12.5');
    expect(valorSql("O'Brien\\")).toBe("'O\\'Brien\\\\'");
    expect(valorSql(Buffer.from([0, 255]))).toBe('0x00ff');
    expect(valorSql(true)).toBe('1');
    expect(valorSql({ a: 1 })).toBe(`'{\\"a\\":1}'`);
  });

  it('detecta mysqldump ausente', async () => {
    expect(await mysqldumpDisponivel('mysqldump-inexistente-atrativa')).toBeNull();
  });
});

async function mysqldumpFalso(pasta: string, falhar: boolean): Promise<string> {
  const arquivo = path.join(pasta, falhar ? 'mysqldump-falha.cjs' : 'mysqldump-ok.cjs');
  await writeFile(
    arquivo,
    [
      `#!${process.execPath}`,
      "const fs = require('fs');",
      'const args = process.argv.slice(2);',
      "if (args[0] === '--version') { console.log('mysqldump  Ver 8.4.0 (teste)'); process.exit(0); }",
      "const cnf = fs.readFileSync(args[0].split('=')[1], 'utf8');",
      falhar
        ? "process.stderr.write('mysqldump: [Warning] Using a password on the command line\\nmysqldump: Got error: 1045: Access denied\\n'); process.exit(2);"
        : "process.stdout.write('-- MySQL dump (teste)\\n-- ARGS ' + JSON.stringify(args.slice(1)) + '\\n-- CNF ' + (cnf.includes('password=\"se\\\\\"nha\"') ? 'ok' : 'ruim') + '\\nINSERT INTO `cad_clientes` VALUES (1,\\'Cliente 1\\',NULL);\\n');",
    ].join('\n'),
  );
  await chmod(arquivo, 0o755);
  return arquivo;
}

describe.skipIf(process.platform === 'win32')('exportarEmpresa com mysqldump', () => {
  let pasta: string;
  beforeAll(async () => {
    pasta = await mkdtemp(path.join(os.tmpdir(), 'mysqldump-falso-'));
  });
  afterAll(async () => {
    await rm(pasta, { recursive: true, force: true });
  });
  const conexao = { host: 'localhost', porta: 3306, usuario: 'root', senha: 'se"nha' };

  it('usa o mysqldump sem expor a senha nos argumentos e acrescenta as tabelas com credenciais anonimizadas', async () => {
    const { resultado, texto } = await exportar({ executavel: await mysqldumpFalso(pasta, false), conexao });
    expect(resultado.ferramenta).toBe('mysqldump (mysqldump  Ver 8.4.0 (teste))');
    const sql = texto('dados/empresa.sql');
    expect(sql.startsWith('-- MySQL dump (teste)')).toBe(true);
    expect(sql).toContain('-- CNF ok');
    const argumentos = JSON.parse(/-- ARGS (.+)/.exec(sql)![1]) as string[];
    expect(argumentos).toEqual(
      expect.arrayContaining([
        '--single-transaction',
        '--skip-add-drop-table',
        '--ignore-table=atrativa_emp_3.api_credencial',
        '--ignore-table=atrativa_emp_3.cad_login',
        '--ignore-table=atrativa_emp_3.cad_empresa',
        'atrativa_emp_3',
      ]),
    );
    expect(argumentos.join(' ')).not.toContain('se"nha');
    expect(sql).toContain("(1,'Ana','ana',NULL)");
    expect(sql).toContain('CREATE TABLE `api_credencial`');
    expect(sql).not.toMatch(/'123456'|SEGREDO-LIBERACAO|\$2b\$10\$hash/);
    expect(JSON.parse(texto('metadados.json')).ferramenta).toMatch(/^mysqldump/);
  });

  it('volta para o exportador interno quando o mysqldump falha', async () => {
    const { resultado, texto } = await exportar({ executavel: await mysqldumpFalso(pasta, true), conexao });
    expect(resultado.ferramenta).toBe('exportador interno (formato mysqldump)');
    expect(resultado.aviso).toContain('1045: Access denied');
    expect(resultado.aviso).not.toContain('Using a password');
    expect(texto('dados/empresa.sql').match(/^\(\d+,'Cliente \d+'/gm)).toHaveLength(4500);
    expect(JSON.parse(texto('metadados.json')).aviso).toContain('mysqldump falhou');
  });
});
