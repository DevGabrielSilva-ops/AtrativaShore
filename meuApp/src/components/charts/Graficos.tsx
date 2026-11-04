import { useEffect, useId, useRef, useState } from 'react';

export interface PontoSerie {
  rotulo: string;
  rotuloEixo?: string;
  valor: number;
  detalhe?: string;
}

function useLargura<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [largura, setLargura] = useState(600);
  useEffect(() => {
    const elemento = ref.current;
    if (!elemento) return;
    const observador = new ResizeObserver(([entrada]) => setLargura(Math.max(240, entrada.contentRect.width)));
    observador.observe(elemento);
    return () => observador.disconnect();
  }, []);
  return { ref, largura };
}

function escalaY(maximo: number, marcas = 4): number[] {
  if (maximo <= 0) return [0, 1];
  const bruto = maximo / marcas;
  const potencia = 10 ** Math.floor(Math.log10(bruto));
  const passo = [1, 2, 2.5, 5, 10].map((m) => m * potencia).find((p) => p >= bruto) ?? bruto;
  const topo = Math.ceil(maximo / passo) * passo;
  return Array.from({ length: Math.round(topo / passo) + 1 }, (_, i) => i * passo);
}

export function GraficoColunas({
  dados,
  formatar,
  formatarEixo,
  rotulo,
  altura = 240,
}: {
  dados: PontoSerie[];
  formatar: (valor: number) => string;
  formatarEixo?: (valor: number) => string;
  rotulo: string;
  altura?: number;
}) {
  const { ref, largura } = useLargura<HTMLDivElement>();
  const [ativo, setAtivo] = useState<number | null>(null);
  const idTabela = useId();

  const margem = { topo: 12, direita: 8, base: 28, esquerda: 64 };
  const larguraUtil = largura - margem.esquerda - margem.direita;
  const alturaUtil = altura - margem.topo - margem.base;
  const ticks = escalaY(Math.max(...dados.map((d) => d.valor), 0));
  const topo = ticks[ticks.length - 1] || 1;
  const banda = larguraUtil / Math.max(1, dados.length);
  const espessura = Math.max(2, Math.min(24, banda - 2));
  const cadaQuantos = Math.max(1, Math.ceil(dados.length / Math.floor(larguraUtil / 56)));
  const y = (valor: number) => margem.topo + alturaUtil - (valor / topo) * alturaUtil;
  const fmtEixo = formatarEixo ?? formatar;

  return (
    <div className="grafico" ref={ref}>
      <svg width={largura} height={altura} role="img" aria-label={rotulo} aria-describedby={idTabela}>
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={margem.esquerda} x2={largura - margem.direita} y1={y(tick)} y2={y(tick)} className="grafico-grade" />
            <text x={margem.esquerda - 8} y={y(tick)} dy="0.32em" textAnchor="end" className="grafico-eixo">
              {fmtEixo(tick)}
            </text>
          </g>
        ))}
        {dados.map((ponto, i) => {
          const cx = margem.esquerda + banda * i + banda / 2;
          const alturaBarra = Math.max(0, y(0) - y(ponto.valor));
          const raio = Math.min(4, espessura / 2, alturaBarra);
          const x = cx - espessura / 2;
          const yTopo = y(ponto.valor);
          const caminho =
            alturaBarra <= 0
              ? ''
              : `M${x},${y(0)} V${yTopo + raio} Q${x},${yTopo} ${x + raio},${yTopo} H${x + espessura - raio} Q${x + espessura},${yTopo} ${x + espessura},${yTopo + raio} V${y(0)} Z`;
          return (
            <g key={ponto.rotulo}>
              {caminho ? <path d={caminho} className={ativo === i ? 'grafico-marca ativa' : 'grafico-marca'} /> : null}
              {i % cadaQuantos === 0 ? (
                <text x={cx} y={altura - 8} textAnchor="middle" className="grafico-eixo">
                  {ponto.rotuloEixo ?? ponto.rotulo}
                </text>
              ) : null}
              <rect
                x={margem.esquerda + banda * i}
                y={margem.topo}
                width={banda}
                height={alturaUtil}
                fill="transparent"
                onMouseEnter={() => setAtivo(i)}
                onMouseLeave={() => setAtivo(null)}
              />
            </g>
          );
        })}
        <line x1={margem.esquerda} x2={largura - margem.direita} y1={y(0)} y2={y(0)} className="grafico-base" />
      </svg>
      {ativo !== null ? (
        <div
          className="grafico-tooltip"
          style={{
            left: Math.min(largura - 170, Math.max(0, margem.esquerda + banda * ativo + banda / 2 - 80)),
            top: Math.max(0, y(dados[ativo].valor) - 64),
          }}
          role="presentation"
        >
          <strong>{dados[ativo].rotulo}</strong>
          <span>{formatar(dados[ativo].valor)}</span>
          {dados[ativo].detalhe ? <span className="muted">{dados[ativo].detalhe}</span> : null}
        </div>
      ) : null}
      <table className="sr-only" id={idTabela}>
        <caption>{rotulo}</caption>
        <tbody>
          {dados.map((ponto) => (
            <tr key={ponto.rotulo}>
              <th scope="row">{ponto.rotulo}</th>
              <td>{formatar(ponto.valor)}</td>
              {ponto.detalhe ? <td>{ponto.detalhe}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


export function GraficoRanking({
  dados,
  formatar,
  rotulo,
}: {
  dados: PontoSerie[];
  formatar: (valor: number) => string;
  rotulo: string;
}) {
  const maximo = Math.max(...dados.map((d) => d.valor), 0) || 1;
  return (
    <ol className="ranking" aria-label={rotulo}>
      {dados.map((ponto) => (
        <li key={ponto.rotulo} title={ponto.detalhe}>
          <span className="ranking-nome">{ponto.rotulo}</span>
          <span className="ranking-trilho" aria-hidden>
            <span className="ranking-barra" style={{ width: `${(ponto.valor / maximo) * 100}%` }} />
          </span>
          <span className="ranking-valor num">{formatar(ponto.valor)}</span>
        </li>
      ))}
    </ol>
  );
}


export function BarraSegmentada({
  partes,
  formatar,
  rotulo,
}: {
  partes: Array<{ nome: string; valor: number; cor: string }>;
  formatar: (valor: number) => string;
  rotulo: string;
}) {
  const total = partes.reduce((soma, parte) => soma + parte.valor, 0);
  const visiveis = partes.filter((parte) => parte.valor > 0);
  return (
    <div className="segmentada">
      <div className="segmentada-barra" role="img" aria-label={`${rotulo}: ${visiveis.map((p) => `${p.nome} ${formatar(p.valor)}`).join(', ')}`}>
        {total > 0 ? (
          visiveis.map((parte) => (
            <span
              key={parte.nome}
              style={{ flexGrow: parte.valor, background: parte.cor }}
              title={`${parte.nome}: ${formatar(parte.valor)} (${Math.round((parte.valor / total) * 100)}%)`}
            />
          ))
        ) : (
          <span className="segmentada-vazia" />
        )}
      </div>
      <ul className="segmentada-legenda">
        {partes.map((parte) => (
          <li key={parte.nome}>
            <span className="legenda-marca" style={{ background: parte.cor }} aria-hidden />
            <span>{parte.nome}</span>
            <span className="num legenda-valor">{formatar(parte.valor)}</span>
            <span className="muted num pequeno">{total > 0 ? `${Math.round((parte.valor / total) * 100)}%` : '—'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
