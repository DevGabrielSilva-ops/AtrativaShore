export function Spinner({ tamanho = 20, rotulo }: { tamanho?: number; rotulo?: string }) {
  return (
    <span className="spinner" style={{ width: tamanho, height: tamanho }} role={rotulo ? 'status' : undefined}>
      {rotulo ? <span className="sr-only">{rotulo}</span> : null}
    </span>
  );
}

export function Skeleton({ largura = '100%', altura = 14 }: { largura?: number | string; altura?: number }) {
  return <span className="skeleton" style={{ width: largura, height: altura }} aria-hidden />;
}
