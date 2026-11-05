const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'];
const R = L.map((padrao) => [...padrao].map((bit) => (bit === '1' ? '0' : '1')).join(''));
const PARIDADE = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

export function digitoEan13(doze: string): number {
  const soma = [...doze].reduce((total, digito, i) => total + Number(digito) * (i % 2 === 0 ? 1 : 3), 0);
  return (10 - (soma % 10)) % 10;
}

export function ean13Valido(codigo: string): boolean {
  return /^\d{13}$/.test(codigo) && digitoEan13(codigo.slice(0, 12)) === Number(codigo[12]);
}

export function modulosEan13(codigo: string): string {
  if (!ean13Valido(codigo)) throw new Error('EAN-13 inválido');
  const digitos = [...codigo].map(Number);
  const paridade = PARIDADE[digitos[0]];
  const esquerda = digitos.slice(1, 7).map((d, i) => (paridade[i] === 'L' ? L[d] : G[d])).join('');
  const direita = digitos.slice(7).map((d) => R[d]).join('');
  return `101${esquerda}01010${direita}101`;
}
