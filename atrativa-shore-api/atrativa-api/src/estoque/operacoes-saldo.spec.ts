import { ConflictException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { agruparQuantidades, baixarSaldo, creditarSaldo } from './operacoes-saldo.js';

function manager(respostas: unknown[]) {
  const chamadas: Array<{ sql: string; parametros: unknown[] }> = [];
  const falso = {
    query: async (sql: string, parametros: unknown[]) => {
      chamadas.push({ sql, parametros });
      return respostas.shift();
    },
  } as unknown as EntityManager;
  return { falso, chamadas };
}

describe('operações de saldo', () => {
  it('baixa com UPDATE condicional, que impede saldo negativo', async () => {
    const { falso, chamadas } = manager([{ affectedRows: 1 }]);
    await baixarSaldo(falso, 10, 2, 'TOALHA');
    expect(chamadas[0].sql).toMatch(/WHERE id_produto = \? AND quantidade \+ \? >= \?/);
    expect(chamadas[0].parametros).toEqual([2, 10, 0.0005, 2]);
  });

  it('lança 409 quando o UPDATE não afeta nenhuma linha', async () => {
    const { falso } = manager([{ affectedRows: 0 }]);
    await expect(baixarSaldo(falso, 10, 2, 'TOALHA')).rejects.toThrow(ConflictException);
  });

  it('cria a linha de saldo quando o produto ainda não tem uma', async () => {
    const { falso, chamadas } = manager([{ affectedRows: 0 }, { affectedRows: 1 }]);
    await creditarSaldo(falso, 45, 3);
    expect(chamadas[1].sql).toMatch(/^INSERT INTO mv_estoque/);
    expect(chamadas[1].parametros).toEqual([45, 3, 1]);
  });

  it('agrupa quantidades do mesmo produto', () => {
    const mapa = agruparQuantidades([
      { idProduto: 1, quantidade: 0.1 },
      { idProduto: 1, quantidade: 0.2 },
      { idProduto: 2, quantidade: 1 },
    ]);
    expect(mapa.get(1)).toBe(0.3);
    expect(mapa.get(2)).toBe(1);
  });
});
