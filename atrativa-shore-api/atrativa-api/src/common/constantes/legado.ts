export const MODO_VENDA = {
  PRODUTO: 1,
  TROCA: 4,
  RECEBIMENTO_CARNE: 6,
} as const;

export const MODO_LANCAMENTO = {
  PADRAO: 0,
  TROCA: 2,
} as const;

export const MODO_ESTOQUE = {
  CONTROLA: 1,
  SERVICO: 6,
} as const;

export const ORIGEM_FINANCEIRO = {
  VENDA: 'V',
  CARNE: 'C',
  ENTRADA_MERCADORIA: 'E',
} as const;

export const TIPO_FINANCEIRO = {
  ENTRADA: 'E',
  SAIDA: 'S',
} as const;

export const PLANO_CONTAS = {
  VENDA_A_VISTA: 1,
  COMPRA_MERCADORIA: 2,
  VENDA_CARNE: 5,
} as const;

export const STATUS_CAIXA = {
  ABERTO: 'P',
  FECHADO: 'F',
} as const;

export const SIM = 'S';
export const NAO = 'N';

export const ID_CONSUMIDOR_NAO_IDENTIFICADO = 0;

export enum FormaPagamento {
  DINHEIRO = 'DINHEIRO',
  PIX = 'PIX',
  CARTAO = 'CARTAO',
  CARNE = 'CARNE',
}

export enum MotivoAjusteEstoque {
  PERDA = 'PERDA',
  AVARIA = 'AVARIA',
  CONTAGEM = 'CONTAGEM',
  DEVOLUCAO = 'DEVOLUCAO',
  USO = 'USO',
  OUTRO = 'OUTRO',
}
