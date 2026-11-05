import { barrasCode128, modulosCode128 } from '../utils/code128';
import { ean13Valido, modulosEan13 } from '../utils/ean13';

const MARGEM = 10;

function barrasEan13(codigo: string): Array<{ x: number; largura: number }> {
  const bits = modulosEan13(codigo);
  const barras: Array<{ x: number; largura: number }> = [];
  for (let i = 0; i < bits.length; i += 1) {
    if (bits[i] !== '1') continue;
    const anterior = barras.at(-1);
    if (anterior && anterior.x + anterior.largura === i) anterior.largura += 1;
    else barras.push({ x: i, largura: 1 });
  }
  return barras;
}

export function CodigoBarras({ valor, altura = 12, className = '' }: { valor: string; altura?: number; className?: string }) {
  const ean = ean13Valido(valor);
  const barras = ean ? barrasEan13(valor) : barrasCode128(valor);
  const modulos = (ean ? 95 : modulosCode128(valor)) + MARGEM * 2;
  return (
    <svg
      className={`codigo-barras ${className}`}
      viewBox={`0 0 ${modulos} ${altura}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Código de barras ${valor}`}
      data-formato={ean ? 'EAN-13' : 'Code 128'}
    >
      <rect x="0" y="0" width={modulos} height={altura} fill="#fff" />
      {barras.map((barra) => (
        <rect key={barra.x} x={barra.x + MARGEM} y="0" width={barra.largura} height={altura} fill="#000" />
      ))}
    </svg>
  );
}
