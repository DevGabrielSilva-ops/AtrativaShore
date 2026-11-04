/**
 * Aritmética monetária em centavos inteiros.
 *
 * O banco legado guarda valores em FLOAT(10,2). Somar floats em JavaScript
 * gera erros como 0.1 + 0.2 = 0.30000000000000004, então todo cálculo de
 * venda é feito em centavos (inteiros) e só convertido para reais na gravação.
 */

export type Centavos = number;

/** Arredonda half-up (0,5 sobe) de forma simétrica para negativos. */
function arredondar(valor: number): number {
  const sinal = valor < 0 ? -1 : 1;
  // toPrecision(15) elimina o ruído binário (ex.: 1.005 * 100 = 100.49999999999999).
  const absoluto = Number(Math.abs(valor).toPrecision(15));
  return sinal * Math.round(absoluto);
}

export function paraCentavos(valor: number | string | null | undefined): Centavos {
  if (valor === null || valor === undefined || valor === '') return 0;
  const numero = typeof valor === 'string' ? Number(valor) : valor;
  if (!Number.isFinite(numero)) {
    throw new RangeError(`Valor monetário inválido: ${String(valor)}`);
  }
  return arredondar(numero * 100);
}

export function paraReais(centavos: Centavos): number {
  return centavos / 100;
}

/** Valor unitário (centavos) × quantidade (até 3 casas) → total em centavos. */
export function multiplicar(centavos: Centavos, quantidade: number): Centavos {
  return arredondar(centavos * quantidade);
}

export function somar(valores: Centavos[]): Centavos {
  return valores.reduce((total, valor) => total + valor, 0);
}

/** Arredonda um número qualquer para N casas (usado na leitura das colunas FLOAT). */
export function arredondarCasas(valor: number, casas: number): number {
  const fator = 10 ** casas;
  return arredondar(valor * fator) / fator;
}

export function arredondarQuantidade(quantidade: number): number {
  return arredondarCasas(quantidade, 3);
}

/**
 * Distribui um valor entre partes proporcionalmente aos pesos, sem perder
 * nem criar centavos (método do maior resto). A soma do resultado é
 * sempre exatamente igual a `total`.
 */
export function ratear(total: Centavos, pesos: number[]): Centavos[] {
  if (pesos.length === 0) return [];
  if (!Number.isInteger(total)) throw new RangeError('total deve estar em centavos');
  if (pesos.some((peso) => peso < 0)) throw new RangeError('pesos não podem ser negativos');

  const sinal = total < 0 ? -1 : 1;
  const absoluto = Math.abs(total);
  const somaPesos = pesos.reduce((s, p) => s + p, 0);

  if (somaPesos === 0) {
    // Sem base proporcional: divide igualmente.
    return ratear(total, pesos.map(() => 1));
  }

  const exatos = pesos.map((peso) => (absoluto * peso) / somaPesos);
  const partes = exatos.map((valor) => Math.floor(valor));
  let restante = absoluto - somar(partes);

  const ordemPorResto = exatos
    .map((valor, indice) => ({ indice, resto: valor - Math.floor(valor) }))
    .sort((a, b) => b.resto - a.resto || a.indice - b.indice);

  for (let i = 0; restante > 0; i = (i + 1) % ordemPorResto.length) {
    partes[ordemPorResto[i].indice] += 1;
    restante -= 1;
  }

  return partes.map((parte) => sinal * parte);
}

/**
 * Divide o valor do carnê em parcelas no mesmo padrão do sistema legado:
 * as primeiras parcelas recebem o valor arredondado e a última absorve a
 * diferença (ex.: 119,00 em 3 → 39,67 + 39,67 + 39,66).
 */
export function dividirParcelas(total: Centavos, quantidade: number): Centavos[] {
  if (!Number.isInteger(quantidade) || quantidade < 1) {
    throw new RangeError('quantidade de parcelas inválida');
  }
  const base = Math.round(total / quantidade);
  const parcelas = Array.from({ length: quantidade }, () => base);
  parcelas[quantidade - 1] = total - base * (quantidade - 1);
  return parcelas;
}

export function formatarReais(centavos: Centavos): string {
  const negativo = centavos < 0;
  const absoluto = Math.abs(centavos);
  const inteiro = Math.floor(absoluto / 100).toString();
  const decimal = (absoluto % 100).toString().padStart(2, '0');
  return `${negativo ? '-' : ''}${inteiro},${decimal}`;
}
