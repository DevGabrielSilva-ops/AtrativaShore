import { FormaPagamento } from '../../common/constantes/legado.js';
import { calcularVenda, type EntradaCalculo, ErroCalculoVenda } from './calculo-venda.js';

function entrada(parcial: Partial<EntradaCalculo>): EntradaCalculo {
  return {
    itens: [],
    trocas: [],
    desconto: 0,
    acrescimo: 0,
    pagamentos: [],
    descontoMaximoPercentual: null,
    ...parcial,
  };
}

describe('calcularVenda', () => {
  it('calcula total, itens e pagamento simples', () => {
    const resultado = calcularVenda(
      entrada({
        itens: [{ idProduto: 1, quantidade: 2, precoUnitario: 2999 }],
        pagamentos: [{ forma: FormaPagamento.DINHEIRO, valor: 5998 }],
      }),
    );
    expect(resultado.bruto).toBe(5998);
    expect(resultado.liquido).toBe(5998);
    expect(resultado.itens[0]).toMatchObject({ total: 5998, valorUnitario: 2999 });
    expect(resultado.porForma.DINHEIRO).toBe(5998);
  });

  it('rateia o desconto nos itens como o desktop (venda real 20260824141339: 12,00 − 2,00 = 10,00)', () => {
    const resultado = calcularVenda(
      entrada({
        itens: [{ idProduto: 1, quantidade: 1, precoUnitario: 1200 }],
        desconto: 200,
        pagamentos: [{ forma: FormaPagamento.DINHEIRO, valor: 1000 }],
      }),
    );
    expect(resultado.itens[0].total).toBe(1000);
    expect(resultado.desconto).toBe(200);
    expect(resultado.liquido).toBe(1000);
  });

  it('a soma dos itens bate exatamente com o total mesmo com rateio quebrado', () => {
    const resultado = calcularVenda(
      entrada({
        itens: [
          { idProduto: 1, quantidade: 1, precoUnitario: 1000 },
          { idProduto: 2, quantidade: 1, precoUnitario: 1000 },
          { idProduto: 3, quantidade: 1, precoUnitario: 1000 },
        ],
        desconto: 100,
        pagamentos: [{ forma: FormaPagamento.PIX, valor: 2900 }],
      }),
    );
    const soma = resultado.itens.reduce((total, item) => total + item.total, 0);
    expect(soma).toBe(2900);
    expect(resultado.itens.map((item) => item.total).sort()).toEqual([966, 967, 967]);
  });

  it('rateia o acréscimo nos itens', () => {
    const resultado = calcularVenda(
      entrada({
        itens: [
          { idProduto: 1, quantidade: 1, precoUnitario: 3000 },
          { idProduto: 2, quantidade: 1, precoUnitario: 1000 },
        ],
        acrescimo: 400,
        pagamentos: [{ forma: FormaPagamento.CARTAO, valor: 4400 }],
      }),
    );
    expect(resultado.itens.map((item) => item.total)).toEqual([3300, 1100]);
  });

  it('abate o crédito da troca (venda real 20260807104927: 36 + 18 + 24 − 63 = 15)', () => {
    const resultado = calcularVenda(
      entrada({
        itens: [
          { idProduto: 118, quantidade: 1, precoUnitario: 3600 },
          { idProduto: 444, quantidade: 1, precoUnitario: 1800 },
          { idProduto: 484, quantidade: 1, precoUnitario: 2400 },
        ],
        trocas: [{ idProduto: 119, quantidade: 1, precoUnitario: 6300 }],
        pagamentos: [{ forma: FormaPagamento.CARNE, valor: 1500 }],
      }),
    );
    expect(resultado.creditoTroca).toBe(6300);
    expect(resultado.liquido).toBe(1500);
  });

  it('aceita pagamento dividido em várias formas', () => {
    const resultado = calcularVenda(
      entrada({
        itens: [{ idProduto: 1, quantidade: 1, precoUnitario: 84150 }],
        pagamentos: [
          { forma: FormaPagamento.DINHEIRO, valor: 34150 },
          { forma: FormaPagamento.CARNE, valor: 50000 },
        ],
      }),
    );
    expect(resultado.porForma).toMatchObject({ DINHEIRO: 34150, CARNE: 50000, PIX: 0, CARTAO: 0 });
  });

  it('aceita quantidade fracionada (venda por metro)', () => {
    const resultado = calcularVenda(
      entrada({
        itens: [{ idProduto: 451, quantidade: 1.5, precoUnitario: 999 }],
        pagamentos: [{ forma: FormaPagamento.DINHEIRO, valor: 1499 }],
      }),
    );
    expect(resultado.itens[0].total).toBe(1499);
  });

  it('troca que zera o total dispensa pagamento', () => {
    const resultado = calcularVenda(
      entrada({
        itens: [{ idProduto: 1, quantidade: 1, precoUnitario: 2000 }],
        trocas: [{ idProduto: 2, quantidade: 1, precoUnitario: 2000 }],
        pagamentos: [],
      }),
    );
    expect(resultado.liquido).toBe(0);
  });

  describe('rejeita', () => {
    const base = { itens: [{ idProduto: 1, quantidade: 1, precoUnitario: 1000 }] };

    it('venda sem produtos', () => {
      expect(() => calcularVenda(entrada({ pagamentos: [] }))).toThrow(ErroCalculoVenda);
    });

    it('pagamentos que não fecham com o total calculado (o total do frontend não é aceito)', () => {
      expect(() =>
        calcularVenda(entrada({ ...base, pagamentos: [{ forma: FormaPagamento.DINHEIRO, valor: 900 }] })),
      ).toThrow(/soma dos pagamentos/);
    });

    it('forma de pagamento repetida', () => {
      expect(() =>
        calcularVenda(
          entrada({
            ...base,
            pagamentos: [
              { forma: FormaPagamento.DINHEIRO, valor: 500 },
              { forma: FormaPagamento.DINHEIRO, valor: 500 },
            ],
          }),
        ),
      ).toThrow(/repetida/);
    });

    it('desconto maior que o valor dos produtos', () => {
      expect(() => calcularVenda(entrada({ ...base, desconto: 1001, pagamentos: [] }))).toThrow(/maior que o valor/);
    });

    it('desconto acima do máximo da empresa', () => {
      expect(() =>
        calcularVenda(
          entrada({
            ...base,
            desconto: 200,
            descontoMaximoPercentual: 10,
            pagamentos: [{ forma: FormaPagamento.DINHEIRO, valor: 800 }],
          }),
        ),
      ).toThrow(/máximo permitido/);
    });

    it('troca maior que a compra', () => {
      expect(() =>
        calcularVenda(
          entrada({ ...base, trocas: [{ idProduto: 2, quantidade: 1, precoUnitario: 1500 }], pagamentos: [] }),
        ),
      ).toThrow(/devolvidos/);
    });

    it('quantidade zero, negativa ou com mais de 3 casas', () => {
      for (const quantidade of [0, -1, 1.2345]) {
        expect(() =>
          calcularVenda(
            entrada({ itens: [{ idProduto: 1, quantidade, precoUnitario: 1000 }], pagamentos: [] }),
          ),
        ).toThrow(ErroCalculoVenda);
      }
    });
  });
});
