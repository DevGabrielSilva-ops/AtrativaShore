import { PassThrough } from 'node:stream';
import type { DataSource } from 'typeorm';
import { exportarEmpresa } from './exportador-empresa.js';
import { lerZip } from './ler-zip.js';
import { EscritorZip } from './zip.js';

type Linha = Record<string, unknown>;

const TABELAS: Record<string, { chave: string[]; linhas: Linha[] }> = {
  cad_empresa: {
    chave: ['id'],
    linhas: [{ id: 1, razao: 'Loja A', fantasia: 'Loja A', chave_liberacao: 'SEGREDO-LIBERACAO' }],
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

function fonteEmpresa(consultas: string[]): DataSource {
  const executor = {
    connect: async () => undefined,
    release: async () => undefined,
    query: async (sql: string): Promise<unknown> => {
      consultas.push(sql);
      if (sql.startsWith('SET') || sql.startsWith('START') || sql === 'ROLLBACK') return [];
      if (sql.includes('information_schema.TABLES')) return Object.keys(TABELAS).sort().map((nome) => ({ nome }));
      let m = /^SELECT COUNT\(\*\) AS total FROM `(\w+)`$/.exec(sql);
      if (m) return [{ total: String(TABELAS[m[1]].linhas.length) }];
      m = /^SHOW COLUMNS FROM `(\w+)`$/.exec(sql);
      if (m) return Object.keys(TABELAS[m[1]].linhas[0]).map((Field) => ({ Field }));
      m = /^SHOW KEYS FROM `(\w+)`/.exec(sql);
      if (m) return TABELAS[m[1]].chave.map((Column_name, i) => ({ Column_name, Seq_in_index: i + 1 }));
      if (sql === 'SELECT * FROM cad_empresa ORDER BY id LIMIT 1') return TABELAS.cad_empresa.linhas.slice(0, 1);
      m = /^SELECT (.+) FROM `(\w+)` ORDER BY .+ LIMIT (\d+) OFFSET (\d+)$/.exec(sql);
      if (m) {
        const colunas = m[1].split(', ').map((c) => c.replace(/`/g, ''));
        const inicio = Number(m[4]);
        return TABELAS[m[2]].linhas
          .slice(inicio, inicio + Number(m[3]))
          .map((linha) => Object.fromEntries(colunas.map((c) => [c, linha[c]])));
      }
      throw new Error(`SQL inesperado: ${sql}`);
    },
  };
  return { createQueryRunner: () => executor } as unknown as DataSource;
}

function fontePlataforma(parametros: unknown[][]): DataSource {
  return {
    query: async (sql: string, params: unknown[]) => {
      parametros.push(params);
      if (sql.includes('FROM plataforma_usuarios')) {
        expect(sql).not.toContain('senha_hash');
        expect(sql).not.toContain('versao_token');
        return [{ id: 10, id_empresa: params[0], nome: 'Admin A', email: 'a@a.com', papel: 'COMPANY_ADMIN' }];
      }
      if (sql.includes('FROM plataforma_empresas WHERE id = ?')) return [{ id: params[0], nome: 'Loja A', status: 'ACTIVE' }];
      if (sql.includes('plataforma_planos')) return [{ id: 1, nome: 'Básico' }];
      if (sql.includes('plataforma_auditoria')) return [{ id: 1, id_empresa: params[0], acao: 'caixa.fechado' }];
      return [];
    },
  } as unknown as DataSource;
}

async function exportar() {
  const consultas: string[] = [];
  const parametros: unknown[][] = [];
  const saida = new PassThrough();
  const partes: Buffer[] = [];
  saida.on('data', (parte: Buffer) => partes.push(parte));
  const zip = new EscritorZip(saida);
  const progresso = vi.fn();
  const resultado = await exportarEmpresa(
    fonteEmpresa(consultas),
    fontePlataforma(parametros),
    zip,
    { idEmpresa: 3, nomeEmpresa: 'Loja A', geradoPor: { id: 10, nome: 'Admin A' }, geradoEm: new Date('2026-11-04T21:00:00Z'), versaoApi: '0.0.1' },
    progresso,
  );
  await zip.finalizar();
  return { resultado, entradas: lerZip(Buffer.concat(partes)), consultas, parametros, progresso };
}

const json = (entradas: Map<string, { conteudo: Buffer }>, nome: string) =>
  JSON.parse(entradas.get(nome)!.conteudo.toString('utf8')) as Record<string, unknown>;

describe('exportarEmpresa', () => {
  it('gera metadados, dados da empresa e uma tabela por arquivo preservando os ids', async () => {
    const { entradas, resultado, progresso } = await exportar();
    expect([...entradas.keys()]).toEqual(
      expect.arrayContaining([
        'empresa.json',
        'metadados.json',
        'LEIA-ME.txt',
        'dados/empresa/cad_clientes.json',
        'dados/empresa/cad_login.json',
        'dados/empresa/mv_fechamento.json',
        'dados/plataforma/plataforma_usuarios.json',
      ]),
    );
    const metadados = json(entradas, 'metadados.json');
    expect(metadados).toMatchObject({ formato: 'atrativa-shore-backup-empresa', versaoFormato: 1, geradoEm: '2026-11-04T21:00:00.000Z' });
    expect(metadados.empresa).toEqual({ id: 3, nome: 'Loja A' });

    const clientes = json(entradas, 'dados/empresa/cad_clientes.json');
    const linhas = clientes.linhas as Linha[];
    expect(linhas).toHaveLength(4500);
    expect(linhas.map((l) => l.id)).toEqual(Array.from({ length: 4500 }, (_, i) => i + 1));
    expect(linhas[0].foto).toEqual({ $base64: Buffer.from([1, 2, 3]).toString('base64') });
    expect(clientes.chavePrimaria).toEqual(['id']);

    const fechamento = json(entradas, 'dados/empresa/mv_fechamento.json');
    expect(fechamento.linhas).toEqual([{ id: 7, data: '2026-11-04', vr_total: '150.00', id_login: 1 }]);
    expect(resultado.registros).toBe(1 + 2 + 4500 + 1 + 1 + 1);
    expect(progresso).toHaveBeenLastCalledWith(97, 'Gravando metadados');
  });

  it('não inclui senhas, hashes nem a chave de liberação', async () => {
    const { entradas } = await exportar();
    expect(entradas.has('dados/empresa/api_credencial.json')).toBe(false);
    const todo = [...entradas.values()].map((e) => e.conteudo.toString('utf8')).join('\n');
    for (const segredo of ['123456', '654321', '$2b$10$hash', 'SEGREDO-LIBERACAO']) {
      expect(todo).not.toContain(segredo);
    }
    const login = json(entradas, 'dados/empresa/cad_login.json');
    expect(login.colunas).toEqual(['id', 'nome', 'usuario']);
    expect(login.colunasOmitidas).toEqual(['senha']);
    expect((json(entradas, 'empresa.json').cadastro as Linha).chave_liberacao).toBeUndefined();
  });

  it('lê o banco da empresa num snapshot consistente e filtra o banco central pela empresa', async () => {
    const { consultas, parametros } = await exportar();
    expect(consultas[1]).toBe('START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY');
    expect(consultas.at(-1)).toBe('ROLLBACK');
    expect(consultas.some((sql) => sql.includes('api_credencial'))).toBe(false);
    expect(parametros.length).toBeGreaterThan(0);
    for (const params of parametros) expect(params).toEqual([3]);
  });
});
