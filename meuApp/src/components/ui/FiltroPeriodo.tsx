import { hojeIso, inicioDoMesIso, somarDiasIso } from '../../utils/formatar';
import type { Periodo } from '../../utils/periodo';

export type { Periodo };

const ATALHOS: Array<{ rotulo: string; periodo: () => Periodo }> = [
  { rotulo: 'Hoje', periodo: () => ({ inicio: hojeIso(), fim: hojeIso() }) },
  { rotulo: '7 dias', periodo: () => ({ inicio: somarDiasIso(hojeIso(), -6), fim: hojeIso() }) },
  { rotulo: 'Este mês', periodo: () => ({ inicio: inicioDoMesIso(), fim: hojeIso() }) },
  { rotulo: '90 dias', periodo: () => ({ inicio: somarDiasIso(hojeIso(), -89), fim: hojeIso() }) },
  { rotulo: '12 meses', periodo: () => ({ inicio: somarDiasIso(hojeIso(), -364), fim: hojeIso() }) },
];

export function FiltroPeriodo({ periodo, aoMudar }: { periodo: Periodo; aoMudar: (periodo: Periodo) => void }) {
  const ativo = ATALHOS.find((atalho) => {
    const p = atalho.periodo();
    return p.inicio === periodo.inicio && p.fim === periodo.fim;
  });
  return (
    <div className="filtro-periodo nao-imprimir" role="group" aria-label="Período">
      <div className="segmentado">
        {ATALHOS.map((atalho) => (
          <button
            key={atalho.rotulo}
            type="button"
            className={ativo === atalho ? 'segmento segmento-ativo' : 'segmento'}
            aria-pressed={ativo === atalho}
            onClick={() => aoMudar(atalho.periodo())}
          >
            {atalho.rotulo}
          </button>
        ))}
      </div>
      <div className="linha">
        <label className="data-compacta">
          <span className="sr-only">Data inicial</span>
          <input
            type="date"
            className="entrada"
            value={periodo.inicio}
            max={periodo.fim}
            onChange={(e) => e.target.value && aoMudar({ ...periodo, inicio: e.target.value })}
          />
        </label>
        <span className="muted pequeno">até</span>
        <label className="data-compacta">
          <span className="sr-only">Data final</span>
          <input
            type="date"
            className="entrada"
            value={periodo.fim}
            min={periodo.inicio}
            onChange={(e) => e.target.value && aoMudar({ ...periodo, fim: e.target.value })}
          />
        </label>
      </div>
    </div>
  );
}
