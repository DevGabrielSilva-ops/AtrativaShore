import { FormaPagamento } from '../../common/constantes/legado.js';
import { type Centavos, formatarReais, multiplicar, ratear, somar } from '../../common/utils/dinheiro.js';

export class ErroCalculoVenda extends Error {}

export interface ItemCalculo {
  idProduto: number;
  quantidade: number;
  precoUnitario: Centavos;
}

export interface PagamentoCalculo {
  forma: FormaPagamento;
  valor: Centavos;
}

export interface EntradaCalculo {
  itens: ItemCalculo[];
  trocas: ItemCalculo[];
  desconto: Centavos;
  acrescimo: Centavos;
  pagamentos: PagamentoCalculo[];
  descontoMaximoPercentual: number | null;
}

export interface ItemCalculado extends ItemCalculo {
  bruto: Centavos;
  total: Centavos;
  valorUnitario: Centavos;
}

export interface ResultadoCalculo {
  itens: ItemCalculado[];
  trocas: ItemCalculado[];
  bruto: Centavos;
  desconto: Centavos;
  acrescimo: Centavos;
  creditoTroca: Centavos;
  liquido: Centavos;
  porForma: Record<FormaPagamento, Centavos>;
}

function validarQuantidade(quantidade: number, contexto: string): void {
  if (!Number.isFinite(quantidade) || quantidade <= 0) {
    throw new ErroCalculoVenda(`${contexto}: quantidade deve ser maior que zero`);
  }
  if (Math.abs(Math.round(quantidade * 1000) - quantidade * 1000) > 1e-6) {
    throw new ErroCalculoVenda(`${contexto}: quantidade aceita no máximo 3 casas decimais`);
  }
}

function validarCentavos(valor: Centavos, contexto: string, permitirZero = true): void {
  if (!Number.isInteger(valor) || valor < 0 || (!permitirZero && valor === 0)) {
    throw new ErroCalculoVenda(`${contexto} inválido`);
  }
}

export function calcularVenda(entrada: EntradaCalculo): ResultadoCalculo {
  if (entrada.itens.length === 0) {
    throw new ErroCalculoVenda('A venda precisa ter pelo menos um produto');
  }
  validarCentavos(entrada.desconto, 'desconto');
  validarCentavos(entrada.acrescimo, 'acréscimo');

  const brutos = entrada.itens.map((item, indice) => {
    validarQuantidade(item.quantidade, `itens[${indice}]`);
    validarCentavos(item.precoUnitario, `itens[${indice}].precoUnitario`, false);
    return multiplicar(item.precoUnitario, item.quantidade);
  });
  const bruto = somar(brutos);

  if (entrada.desconto > bruto) {
    throw new ErroCalculoVenda(
      `Desconto (${formatarReais(entrada.desconto)}) maior que o valor dos produtos (${formatarReais(bruto)})`,
    );
  }
  const maximo = entrada.descontoMaximoPercentual;
  if (maximo !== null && maximo >= 0 && entrada.desconto > 0 && entrada.desconto * 100 > maximo * bruto + 1e-9) {
    throw new ErroCalculoVenda(`Desconto acima do máximo permitido pela empresa (${maximo}%)`);
  }

  const ajustes = ratear(entrada.acrescimo - entrada.desconto, brutos);
  const itens: ItemCalculado[] = entrada.itens.map((item, indice) => {
    const total = brutos[indice] + ajustes[indice];
    return {
      ...item,
      bruto: brutos[indice],
      total,
      valorUnitario: Math.round(total / item.quantidade),
    };
  });

  const trocas: ItemCalculado[] = entrada.trocas.map((item, indice) => {
    validarQuantidade(item.quantidade, `itensTroca[${indice}]`);
    validarCentavos(item.precoUnitario, `itensTroca[${indice}].precoUnitario`, false);
    const total = multiplicar(item.precoUnitario, item.quantidade);
    return { ...item, bruto: total, total, valorUnitario: item.precoUnitario };
  });
  const creditoTroca = somar(trocas.map((item) => item.total));

  const liquido = somar(itens.map((item) => item.total)) - creditoTroca;
  if (liquido < 0) {
    throw new ErroCalculoVenda(
      `O valor dos itens devolvidos (${formatarReais(creditoTroca)}) é maior que o da compra. ` +
        'Inclua mais produtos ou reduza a troca.',
    );
  }

  const porForma: Record<FormaPagamento, Centavos> = {
    [FormaPagamento.DINHEIRO]: 0,
    [FormaPagamento.PIX]: 0,
    [FormaPagamento.CARTAO]: 0,
    [FormaPagamento.CARNE]: 0,
  };
  for (const pagamento of entrada.pagamentos) {
    validarCentavos(pagamento.valor, `pagamento ${pagamento.forma}`, false);
    if (porForma[pagamento.forma] > 0) {
      throw new ErroCalculoVenda(`Forma de pagamento repetida: ${pagamento.forma}`);
    }
    porForma[pagamento.forma] = pagamento.valor;
  }
  const pago = somar(Object.values(porForma));
  if (pago !== liquido) {
    throw new ErroCalculoVenda(
      `A soma dos pagamentos (${formatarReais(pago)}) deve ser igual ao total da venda (${formatarReais(liquido)})`,
    );
  }

  return {
    itens,
    trocas,
    bruto,
    desconto: entrada.desconto,
    acrescimo: entrada.acrescimo,
    creditoTroca,
    liquido,
    porForma,
  };
}
