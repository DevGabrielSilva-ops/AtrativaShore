/**
 * Valores de domínio usados pelo sistema desktop legado.
 * Todos foram identificados nos dados reais (ver docs/DATABASE_MAPPING.md).
 */

/** mv_vendas_movimento.modo_venda */
export const MODO_VENDA = {
  PRODUTO: 1,
  TROCA: 4,
  RECEBIMENTO_CARNE: 6,
} as const;

/** mv_vendas_movimento.modo_lancamento (significado não documentado; o legado usa 2 em trocas). */
export const MODO_LANCAMENTO = {
  PADRAO: 0,
  TROCA: 2,
} as const;

/** cad_produtos.modo_estoque */
export const MODO_ESTOQUE = {
  CONTROLA: 1,
  SERVICO: 6,
} as const;

/** mv_financeiro.origem_lancamento */
export const ORIGEM_FINANCEIRO = {
  VENDA: 'V',
  CARNE: 'C',
  ENTRADA_MERCADORIA: 'E',
} as const;

/** mv_financeiro.tipo_lancamento */
export const TIPO_FINANCEIRO = {
  ENTRADA: 'E',
  SAIDA: 'S',
} as const;

/** cad_plano_de_contas.id */
export const PLANO_CONTAS = {
  VENDA_A_VISTA: 1,
  COMPRA_MERCADORIA: 2,
  VENDA_CARNE: 5,
} as const;

/**
 * mv_fechamento.status_caixa. 'F' = fechado (1.811 registros).
 * 'P' aparece só no último caixa do terminal: tratado como aberto (inferência).
 */
export const STATUS_CAIXA = {
  ABERTO: 'P',
  FECHADO: 'F',
} as const;

export const SIM = 'S';
export const NAO = 'N';

/** mv_vendas.id_cliente = 0 quando a venda não tem cliente identificado. */
export const ID_CONSUMIDOR_NAO_IDENTIFICADO = 0;

export enum FormaPagamento {
  DINHEIRO = 'DINHEIRO',
  PIX = 'PIX',
  CARTAO = 'CARTAO',
  CARNE = 'CARNE',
}

/** Motivos de ajuste manual de estoque (gravados em mv_estoque_historico.numerodanota como "AJ-<MOTIVO>"). */
export enum MotivoAjusteEstoque {
  PERDA = 'PERDA',
  AVARIA = 'AVARIA',
  CONTAGEM = 'CONTAGEM',
  DEVOLUCAO = 'DEVOLUCAO',
  USO = 'USO',
  OUTRO = 'OUTRO',
}
