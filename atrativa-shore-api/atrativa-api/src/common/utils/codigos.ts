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

export function codigoBarrasCliente(idCliente: number): string {
  if (!Number.isInteger(idCliente) || idCliente < 1 || idCliente > 99_999_999_999) {
    throw new RangeError(`id de cliente inválido: ${idCliente}`);
  }
  const doze = `1${String(idCliente).padStart(11, '0')}`;
  return doze + digitoEan13(doze);
}

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

export function codigoBarrasProduto(base: number): string {
  const doze = `2${String(base).padStart(11, '0')}`.slice(0, 12);
  return doze + digitoEan13(doze);
}

export function documentoVenda(controle: string): string {
  return `V${controle}`;
}

export function notaTroca(controle: string): string {
  return `V${controle.slice(3)}`;
}

export const PREFIXO_NOTA_AJUSTE = 'AJ-';
