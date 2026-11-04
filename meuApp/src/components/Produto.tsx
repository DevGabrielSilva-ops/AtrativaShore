import type { Produto } from '../types/api';
import { formatarMoeda, formatarNumero } from '../utils/formatar';
import { Badge } from './ui/Estados';

/** Saldo do produto com aviso de esgotado/abaixo do mínimo (texto + cor, nunca só cor). */
export function BadgeEstoque({ produto }: { produto: Produto }) {
  if (!produto.controlaEstoque) return <Badge>Serviço</Badge>;
  const saldo = produto.quantidadeEstoque;
  if (saldo == null) return <Badge tom="neutro">Sem saldo</Badge>;
  if (saldo <= 0) return <Badge tom="perigo">{formatarNumero(saldo)} · esgotado</Badge>;
  if (produto.estoqueMinimo && saldo <= produto.estoqueMinimo) return <Badge tom="aviso">{formatarNumero(saldo)} · baixo</Badge>;
  return <span className="num">{formatarNumero(saldo)}</span>;
}

/** Linha de produto nas listas de busca (PDV, nota de entrada, ajuste). */
export function OpcaoProduto({ produto }: { produto: Produto }) {
  return (
    <div className="opcao-produto">
      <div className="celula-principal">
        <strong>{produto.nome}</strong>
        <span className="num">{produto.codigoBarras ?? `#${produto.id}`}</span>
      </div>
      <div className="opcao-produto-direita">
        <span className="num">{formatarMoeda(produto.precoPrazo ?? produto.precoVista)}</span>
        <span className="pequeno muted num">Estoque: {formatarNumero(produto.quantidadeEstoque ?? 0)}</span>
      </div>
    </div>
  );
}
