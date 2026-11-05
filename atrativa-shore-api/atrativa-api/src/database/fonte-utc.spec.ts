import { DataSource } from 'typeorm';
import { iniciarFonteUtc, SESSAO_UTC } from './fonte-utc.js';

describe('fonte da plataforma em UTC', () => {
  it('fixa o fuso UTC na conexão aberta e em cada nova conexão do pool', async () => {
    const executadas: string[] = [];
    let ouvinte: ((conexao: { query: (sql: string, cb: (e: Error | null) => void) => unknown }) => void) | undefined;
    vi.spyOn(DataSource.prototype, 'initialize').mockImplementation(async function (this: DataSource) {
      Object.defineProperty(this, 'driver', {
        value: { pool: { on: (_evento: string, f: typeof ouvinte) => (ouvinte = f) } },
        configurable: true,
      });
      return this;
    });
    vi.spyOn(DataSource.prototype, 'query').mockImplementation(async (sql: string) => {
      executadas.push(sql);
      return [];
    });
    await iniciarFonteUtc({ type: 'mysql' });
    expect(executadas).toEqual([SESSAO_UTC]);
    const naConexao: string[] = [];
    ouvinte?.({ query: (sql, cb) => (naConexao.push(sql), cb(null)) });
    expect(naConexao).toEqual([SESSAO_UTC]);
    vi.restoreAllMocks();
  });
});
