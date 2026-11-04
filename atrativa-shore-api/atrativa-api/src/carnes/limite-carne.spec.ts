import { ConflictException } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { calcularLimiteCarne, consultarCreditoCarne, garantirLimiteCarne } from './limite-carne.js';

const regra = { percentualRenda: 50, limitePadrao: 300 };

describe('calcularLimiteCarne', () => {
  it('usa o percentual da faixa salarial', () => {
    expect(calcularLimiteCarne({ limiteCarne: null, faixaSalarial: 1500 }, regra)).toEqual({ limite: 75000, origem: 'RENDA' });
  });

  it('arredonda para baixo', () => {
    expect(calcularLimiteCarne({ limiteCarne: null, faixaSalarial: 980.01 }, { ...regra, percentualRenda: 33 }).limite).toBe(32340);
  });

  it('limite manual tem prioridade, inclusive zero (bloqueia o carnê)', () => {
    expect(calcularLimiteCarne({ limiteCarne: 2000, faixaSalarial: 1500 }, regra)).toEqual({ limite: 200000, origem: 'MANUAL' });
    expect(calcularLimiteCarne({ limiteCarne: 0, faixaSalarial: 1500 }, regra)).toEqual({ limite: 0, origem: 'MANUAL' });
  });

  it('sem renda (nula ou zero) usa o limite padrão', () => {
    expect(calcularLimiteCarne({ limiteCarne: null, faixaSalarial: null }, regra)).toEqual({ limite: 30000, origem: 'PADRAO' });
    expect(calcularLimiteCarne({ limiteCarne: null, faixaSalarial: 0 }, regra).origem).toBe('PADRAO');
  });
});

describe('consultarCreditoCarne', () => {
  const fonte = (cliente: unknown[], total: unknown) =>
    ({
      query: async (sql: string) => (sql.startsWith('SELECT limite_carne') ? cliente : [{ total }]),
    }) as unknown as DataSource;

  it('desconta as parcelas em aberto do limite', async () => {
    const credito = await consultarCreditoCarne(fonte([{ limite_carne: null, faixasalarial: '1500.00' }], '500.50'), 7, regra);
    expect(credito).toMatchObject({ limite: 750, origem: 'RENDA', emAberto: 500.5, disponivel: 249.5 });
  });

  it('disponível nunca fica negativo (cliente já acima do limite)', async () => {
    const credito = await consultarCreditoCarne(fonte([{ limite_carne: '100.00', faixasalarial: null }], 400), 7, regra);
    expect(credito).toMatchObject({ limite: 100, origem: 'MANUAL', emAberto: 400, disponivel: 0 });
  });

  it('retorna null para cliente inexistente', async () => {
    expect(await consultarCreditoCarne(fonte([], 0), 7, regra)).toBeNull();
  });
});

describe('garantirLimiteCarne', () => {
  const credito = { idCliente: 7, limite: 750, origem: 'RENDA' as const, emAberto: 500, disponivel: 250, faixaSalarial: 1500, percentualRenda: 50 };

  it('aceita até o disponível', () => {
    expect(() => garantirLimiteCarne(credito, 25000, 'MARIA')).not.toThrow();
  });

  it('recusa com 409 acima do disponível', () => {
    expect(() => garantirLimiteCarne(credito, 25001, 'MARIA')).toThrow(ConflictException);
  });
});
