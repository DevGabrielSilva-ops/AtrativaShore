import { barrasCode128, modulosCode128 } from '../utils/code128';

export function CodigoBarras({ valor, altura = 12, className = '' }: { valor: string; altura?: number; className?: string }) {
  const modulos = modulosCode128(valor) + 20;
  return (
    <svg
      className={`codigo-barras ${className}`}
      viewBox={`0 0 ${modulos} ${altura}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Código de barras ${valor}`}
    >
      <rect x="0" y="0" width={modulos} height={altura} fill="#fff" />
      {barrasCode128(valor).map((barra) => (
        <rect key={barra.x} x={barra.x + 10} y="0" width={barra.largura} height={altura} fill="#000" />
      ))}
    </svg>
  );
}
