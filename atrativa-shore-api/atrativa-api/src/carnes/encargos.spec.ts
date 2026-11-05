import { calcularEncargos, diasEntre } from './encargos.js';

const config = { jurosDia: 0.35, multa: 1.25, carenciaDias: 5 };

describe('juros e multa do carnê', () => {
  it('conta os dias entre datas, inclusive na virada do ano', () => {
    expect(diasEntre('2026-11-01', '2026-11-11')).toBe(10);
    expect(diasEntre('2026-12-30', '2027-01-02')).toBe(3);
    expect(diasEntre('2026-11-10', '2026-11-05')).toBe(-5);
  });

  it('não cobra nada em dia ou antes do vencimento', () => {
    expect(calcularEncargos(100, '2026-11-10', '2026-11-10', config)).toEqual({ diasAtraso: 0, juros: 0, multa: 0, total: 100 });
    expect(calcularEncargos(100, '2026-11-10', '2026-11-01', config)).toEqual({ diasAtraso: 0, juros: 0, multa: 0, total: 100 });
  });

  it('cobra juros ao dia desde o vencimento e multa só depois da carência', () => {
    expect(calcularEncargos(100, '2026-11-01', '2026-11-04', config)).toEqual({ diasAtraso: 3, juros: 1.05, multa: 0, total: 101.05 });
    expect(calcularEncargos(100, '2026-11-01', '2026-11-06', config)).toEqual({ diasAtraso: 5, juros: 1.75, multa: 0, total: 101.75 });
    expect(calcularEncargos(100, '2026-11-01', '2026-11-11', config)).toEqual({ diasAtraso: 10, juros: 3.5, multa: 1.25, total: 104.75 });
  });

  it('arredonda em centavos', () => {
    expect(calcularEncargos(178.95, '2026-10-10', '2026-11-04', config)).toEqual({ diasAtraso: 25, juros: 15.66, multa: 2.24, total: 196.85 });
  });

  it('sem configuração não cobra encargos', () => {
    expect(calcularEncargos(50, '2026-01-01', '2026-11-04', { jurosDia: 0, multa: 0, carenciaDias: 0 }).total).toBe(50);
  });
});
