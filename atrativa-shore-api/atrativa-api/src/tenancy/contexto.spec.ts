import type { DataSource } from 'typeorm';
import { executarComEmpresa, fonteDaEmpresa, proxyDoContexto } from './contexto.js';

function fonteFalsa(banco: string) {
  const registros: string[] = [];
  return {
    options: { database: banco },
    registros,
    query: async (sql: string) => {
      registros.push(sql);
      await new Promise((resolver) => setTimeout(resolver, Math.random() * 10));
      return [{ banco }];
    },
  } as unknown as DataSource & { registros: string[] };
}

describe('contexto da empresa', () => {
  const proxy = proxyDoContexto(() => fonteDaEmpresa());

  it('recusa operação comercial sem empresa no contexto', async () => {
    expect(() => proxy.query('SELECT 1')).toThrow('sem empresa no contexto');
  });

  it('não quebra a inspeção do Nest fora de uma requisição', () => {
    expect((proxy as unknown as Record<string, unknown>).onModuleInit).toBeUndefined();
    expect((proxy as unknown as Record<string, unknown>).then).toBeUndefined();
  });

  it('cada requisição concorrente usa somente o banco da própria empresa', async () => {
    const a = fonteFalsa('atrativa_emp_1');
    const b = fonteFalsa('atrativa_emp_2');
    const consultar = (fonte: DataSource, rotulo: string) =>
      executarComEmpresa(fonte, async () => {
        const resultados: string[] = [];
        for (let i = 0; i < 20; i += 1) {
          const [linha] = (await proxy.query(`SELECT ${rotulo}-${i}`)) as Array<{ banco: string }>;
          resultados.push(linha.banco);
        }
        return resultados;
      });

    const [deA, deB] = await Promise.all([consultar(a, 'A'), consultar(b, 'B')]);
    expect(new Set(deA)).toEqual(new Set(['atrativa_emp_1']));
    expect(new Set(deB)).toEqual(new Set(['atrativa_emp_2']));
    expect(a.registros.every((sql) => sql.startsWith('SELECT A'))).toBe(true);
    expect(b.registros.every((sql) => sql.startsWith('SELECT B'))).toBe(true);
  });

  it('repositórios do proxy também respeitam o contexto', async () => {
    const repositorioA = { find: async () => ['produto da loja A'] };
    const repositorioB = { find: async () => ['produto da loja B'] };
    const fonteA = { getRepository: () => repositorioA } as unknown as DataSource;
    const fonteB = { getRepository: () => repositorioB } as unknown as DataSource;
    const repositorio = proxyDoContexto(() => fonteDaEmpresa().getRepository('Produto'));
    const [a, b] = await Promise.all([
      executarComEmpresa(fonteA, () => repositorio.find()),
      executarComEmpresa(fonteB, () => repositorio.find()),
    ]);
    expect(a).toEqual(['produto da loja A']);
    expect(b).toEqual(['produto da loja B']);
  });
});
