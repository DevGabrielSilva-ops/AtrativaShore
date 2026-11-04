import { origemLimiteCarne } from '../pages/compartilhado';
import { useRequisicao } from '../hooks/useRequisicao';
import { clienteService } from '../services/servicos';
import { formatarMoeda } from '../utils/formatar';
import { Badge } from './ui/Estados';
import { Skeleton } from './ui/Spinner';

/**
 * Limite do carnê do cliente (GET /clientes/:id/credito-carne): quanto já deve
 * em parcelas abertas e quanto ainda pode comprar. `versao` refaz a consulta
 * (ex.: depois de receber parcelas).
 */
export function CreditoCarneCliente({ idCliente, versao = 0 }: { idCliente: number; versao?: number }) {
  const credito = useRequisicao(() => clienteService.creditoCarne(idCliente), [idCliente, versao]);
  const c = credito.dados;
  if (credito.erro) return <p className="aviso-faixa erro">{credito.erro}</p>;
  if (!c) return <Skeleton altura={84} />;
  const uso = c.limite > 0 ? Math.min(100, (c.emAberto / c.limite) * 100) : 100;
  const esgotado = c.disponivel <= 0;
  return (
    <section className="credito-carne" aria-label="Limite do carnê">
      <div className="credito-carne-topo">
        <div>
          <span className="muted pequeno">Disponível para comprar no carnê</span>
          <strong className={`credito-carne-valor num ${esgotado ? 'nota-negativo' : ''}`}>{formatarMoeda(c.disponivel)}</strong>
        </div>
        {esgotado ? <Badge tom="perigo">Limite atingido</Badge> : null}
      </div>
      <div className="credito-carne-barra" role="img" aria-label={`${Math.round(uso)}% do limite em uso`}>
        <span className={esgotado ? 'esgotado' : undefined} style={{ width: `${uso}%` }} />
      </div>
      <p className="pequeno muted num">
        Em aberto {formatarMoeda(c.emAberto)} de {formatarMoeda(c.limite)} ({origemLimiteCarne(c)}). Cada parcela paga libera o limite.
      </p>
    </section>
  );
}
