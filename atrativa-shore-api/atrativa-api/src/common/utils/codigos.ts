/**
 * Códigos gerados no mesmo formato do sistema desktop legado.
 * Os padrões foram conferidos contra os dados reais do banco:
 *  - código do cliente: 316 de 321 clientes seguem o padrão;
 *  - código do carnê: 8.531 de 8.531 parcelas seguem o padrão.
 */

/** Dígito verificador EAN-13 para 12 dígitos. */
export function digitoEan13(doze: string): string {
  if (!/^\d{12}$/.test(doze)) throw new RangeError(`Esperado 12 dígitos: ${doze}`);
  const soma = doze
    .split('')
    .reduce((total, digito, indice) => total + Number(digito) * (indice % 2 === 0 ? 1 : 3), 0);
  return String((10 - (soma % 10)) % 10);
}

export function eanValido(codigo: string): boolean {
  return /^\d{13}$/.test(codigo) && digitoEan13(codigo.slice(0, 12)) === codigo[12];
}

/** Cliente: "1" + id com 11 dígitos + verificador (id 1 → 1000000000016). */
export function codigoBarrasCliente(idCliente: number): string {
  if (!Number.isInteger(idCliente) || idCliente < 1 || idCliente > 99_999_999_999) {
    throw new RangeError(`id de cliente inválido: ${idCliente}`);
  }
  const doze = `1${String(idCliente).padStart(11, '0')}`;
  return doze + digitoEan13(doze);
}

/**
 * Carnê: DD MM A HHMM PPP + verificador, a partir do controle da venda
 * (controle 20260820160232, parcela 4 → 2008616020045).
 */
export function codigoCarne(controle: string, parcela: number): string {
  if (!/^\d{14}$/.test(controle)) throw new RangeError(`Controle inválido: ${controle}`);
  if (!Number.isInteger(parcela) || parcela < 1 || parcela > 999) {
    throw new RangeError(`Parcela inválida: ${parcela}`);
  }
  const doze =
    controle.slice(6, 8) +
    controle.slice(4, 6) +
    controle.slice(3, 4) +
    controle.slice(8, 12) +
    String(parcela).padStart(3, '0');
  return doze + digitoEan13(doze);
}

/** Produto: "2" + 11 dígitos + verificador (prefixo 2 = uso interno da loja, como no legado). */
export function codigoBarrasProduto(base: number): string {
  const doze = `2${String(base).padStart(11, '0')}`.slice(0, 12);
  return doze + digitoEan13(doze);
}

/** Documento das linhas de mv_financeiro de uma venda: "V" + controle. */
export function documentoVenda(controle: string): string {
  return `V${controle}`;
}

/** Nº da "nota" no histórico de estoque para itens recebidos em troca: "V" + controle sem os 3 primeiros dígitos. */
export function notaTroca(controle: string): string {
  return `V${controle.slice(3)}`;
}

/** Prefixo usado no histórico de estoque para ajustes manuais feitos pela API. */
export const PREFIXO_NOTA_AJUSTE = 'AJ-';
