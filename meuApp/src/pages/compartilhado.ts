import type { CreditoCarne, FormaPagamento, FormasValores, MotivoAjuste, TipoMovimentacao } from '../types/api';

export const ROTULOS_FORMAS: Record<keyof FormasValores, string> = {
  dinheiro: 'Dinheiro',
  pix: 'Pix',
  cartao: 'Cartão',
  carne: 'Carnê',
  outros: 'Cheque/ticket',
};

export const CORES_FORMAS: Record<keyof FormasValores, string> = {
  dinheiro: 'var(--serie-dinheiro)',
  pix: 'var(--serie-pix)',
  cartao: 'var(--serie-cartao)',
  carne: 'var(--serie-carne)',
  outros: 'var(--serie-outros)',
};

export const FORMAS_PAGAMENTO: Array<{ id: FormaPagamento; rotulo: string }> = [
  { id: 'DINHEIRO', rotulo: 'Dinheiro' },
  { id: 'PIX', rotulo: 'Pix' },
  { id: 'CARTAO', rotulo: 'Cartão' },
  { id: 'CARNE', rotulo: 'Carnê' },
];

export const ROTULOS_MOVIMENTACAO: Record<TipoMovimentacao, string> = {
  ENTRADA: 'Entrada (nota)',
  TROCA: 'Devolução em troca',
  AJUSTE_ENTRADA: 'Ajuste (+)',
  AJUSTE_SAIDA: 'Ajuste (−)',
  VENDA: 'Venda',
};

export const MOTIVOS_AJUSTE: Array<{ id: MotivoAjuste; rotulo: string }> = [
  { id: 'PERDA', rotulo: 'Perda' },
  { id: 'AVARIA', rotulo: 'Avaria' },
  { id: 'CONTAGEM', rotulo: 'Correção de contagem' },
  { id: 'DEVOLUCAO', rotulo: 'Devolução ao fornecedor' },
  { id: 'USO', rotulo: 'Uso interno' },
  { id: 'OUTRO', rotulo: 'Outro motivo' },
];

export const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

export function origemLimiteCarne(credito: CreditoCarne): string {
  if (credito.origem === 'MANUAL') return 'definido no cadastro';
  if (credito.origem === 'RENDA') return `${credito.percentualRenda}% da renda`;
  return 'padrão para cliente sem renda cadastrada';
}
