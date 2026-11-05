const PADROES =
  '212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 122231 113222 123122 123221 223211 221132 221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 212123 212321 232121 111323 131123 131321 112313 132113 132311 211313 231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 114131 311141 411131 211412 211214 211232'.split(
    ' ',
  );
const PARADA = '2331112';
const INICIO_B = 104;
const INICIO_C = 105;
const PARA_B = 100;

export function simbolosCode128(texto: string): number[] {
  if (!/^[\x20-\x7e]*$/.test(texto)) throw new Error('Code 128: apenas caracteres ASCII imprimíveis');
  const valores: number[] = [];
  const pares = /^\d{4,}/.exec(texto)?.[0] ?? '';
  const parteC = pares.length - (pares.length % 2);
  if (parteC >= 4) {
    valores.push(INICIO_C);
    for (let i = 0; i < parteC; i += 2) valores.push(Number(texto.slice(i, i + 2)));
    if (parteC < texto.length) valores.push(PARA_B);
  } else {
    valores.push(INICIO_B);
  }
  for (const caractere of texto.slice(parteC >= 4 ? parteC : 0)) valores.push(caractere.charCodeAt(0) - 32);
  const verificador = valores.reduce((soma, valor, posicao) => soma + valor * Math.max(1, posicao), 0) % 103;
  return [...valores, verificador];
}

export function barrasCode128(texto: string): Array<{ x: number; largura: number }> {
  const larguras = simbolosCode128(texto)
    .map((valor) => PADROES[valor])
    .concat(PARADA)
    .join('');
  const barras: Array<{ x: number; largura: number }> = [];
  let x = 0;
  for (let i = 0; i < larguras.length; i += 1) {
    const largura = Number(larguras[i]);
    if (i % 2 === 0) barras.push({ x, largura });
    x += largura;
  }
  return barras;
}

export function modulosCode128(texto: string): number {
  return simbolosCode128(texto).length * 11 + 13;
}
