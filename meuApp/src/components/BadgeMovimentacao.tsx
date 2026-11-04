import type { TipoMovimentacao } from '../types/api';
import { ROTULOS_MOVIMENTACAO } from '../pages/compartilhado';
import { Badge } from './ui/Estados';

export function BadgeMovimentacao({ tipo }: { tipo: TipoMovimentacao }) {
  const tom = tipo === 'VENDA' || tipo === 'AJUSTE_SAIDA' ? 'aviso' : tipo === 'ENTRADA' ? 'sucesso' : 'info';
  return <Badge tom={tom}>{ROTULOS_MOVIMENTACAO[tipo]}</Badge>;
}
