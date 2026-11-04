import {
  arredondarCasas,
  dividirParcelas,
  formatarReais,
  multiplicar,
  paraCentavos,
  paraReais,
  ratear,
} from './dinheiro.js';

describe('dinheiro', () => {
  it('converte reais para centavos sem erro de ponto flutuante', () => {
    expect(paraCentavos(0.1 + 0.2)).toBe(30);
    expect(paraCentavos(1.005)).toBe(101);
    expect(paraCentavos('24.99')).toBe(2499);
    expect(paraCentavos(24.989999771118164)).toBe(2499); // leitura de FLOAT(10,2)
    expect(paraCentavos(null)).toBe(0);
    expect(paraCentavos(-1.005)).toBe(-101);
    expect(paraReais(2499)).toBe(24.99);
  });

  it('recusa valores não numéricos', () => {
    expect(() => paraCentavos('abc')).toThrow(RangeError);
  });

  it('multiplica preço por quantidade fracionada arredondando o total', () => {
    expect(multiplicar(15, 150)).toBe(2250); // 0,15 × 150 = 22,50 (venda real do banco)
    expect(multiplicar(999, 1.5)).toBe(1499); // 14,985 → 14,99
    expect(multiplicar(240, 10)).toBe(2400);
  });

  it('rateia sem perder nem criar centavos', () => {
    const partes = ratear(-1000, [3333, 3333, 3334]);
    expect(partes.reduce((a, b) => a + b, 0)).toBe(-1000);
    expect(partes).toEqual([-333, -333, -334]);

    const desiguais = ratear(1, [1, 1, 1]);
    expect(desiguais.reduce((a, b) => a + b, 0)).toBe(1);

    const proporcional = ratear(300, [1000, 2000]);
    expect(proporcional).toEqual([100, 200]);
  });

  it('rateia igualmente quando todos os pesos são zero', () => {
    expect(ratear(3, [0, 0, 0])).toEqual([1, 1, 1]);
  });

  it('divide o carnê como o desktop (última parcela absorve a diferença)', () => {
    expect(dividirParcelas(11900, 3)).toEqual([3967, 3967, 3966]); // 119,00 → 39,67 + 39,67 + 39,66
    expect(dividirParcelas(50000, 4)).toEqual([12500, 12500, 12500, 12500]);
    expect(dividirParcelas(9000, 3)).toEqual([3000, 3000, 3000]);
    expect(() => dividirParcelas(100, 0)).toThrow(RangeError);
  });

  it('formata no padrão usado no histórico do legado', () => {
    expect(formatarReais(50000)).toBe('500,00');
    expect(formatarReais(2499)).toBe('24,99');
    expect(formatarReais(5)).toBe('0,05');
  });

  it('arredonda quantidades lidas de FLOAT(10,3)', () => {
    expect(arredondarCasas(43760.3984375, 3)).toBe(43760.398);
  });
});
