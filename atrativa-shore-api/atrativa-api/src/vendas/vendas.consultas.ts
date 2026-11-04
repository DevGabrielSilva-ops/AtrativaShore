import { FormaPagamento } from '../common/constantes/legado.js';
import { horaDoControle } from '../common/utils/datas.js';
import { numero } from '../common/utils/transformadores.js';

/** Consultas e mapeamentos de venda reutilizados por vendas, clientes, caixa e relatórios. */

export interface ValoresPagamento {
  dinheiro: number;
  pix: number;
  cartao: number;
  carne: number;
  cheque: number;
  ticket: number;
}

export interface VendaResumo {
  id: number;
  controle: string;
  data: string | null;
  hora: string | null;
  cliente: { id: number; nome: string | null } | null;
  vendedor: { id: number; login: string | null } | null;
  total: number;
  desconto: number;
  pagamentos: ValoresPagamento;
  formasPagamento: string[];
  estornada: boolean;
  dataEstorno: string | null;
  terminal: string | null;
  turno: string | null;
}

export interface LinhaVenda {
  id: number;
  controle: string;
  data_venda: string | null;
  id_cliente: number | null;
  nome_cliente: string | null;
  id_login: number | null;
  login: string | null;
  vr_total: number | string | null;
  vr_adicional: number | string | null;
  vr_dinheiro: number | string | null;
  vr_pix: number | string | null;
  vr_cartao: number | string | null;
  vr_carne: number | string | null;
  vr_cheque: number | string | null;
  vr_ticket: number | string | null;
  estornado: number | null;
  estornado_data: string | null;
  terminal: string | null;
  turno: string | null;
}

export const SELECT_VENDA = `
  SELECT v.id, v.controle, v.data_venda, v.id_cliente, c.nome_cliente, v.id_login, l.login,
         v.vr_total, v.vr_adicional, v.vr_dinheiro, v.vr_pix, v.vr_cartao, v.vr_carne, v.vr_cheque,
         v.vr_ticket, v.estornado, v.estornado_data, v.terminal, v.turno
    FROM mv_vendas v
    LEFT JOIN cad_clientes c ON c.id = v.id_cliente
    LEFT JOIN cad_login l ON l.id = v.id_login`;

/** Coluna de mv_vendas para cada forma de pagamento. */
export const COLUNA_FORMA: Record<FormaPagamento, string> = {
  [FormaPagamento.DINHEIRO]: 'vr_dinheiro',
  [FormaPagamento.PIX]: 'vr_pix',
  [FormaPagamento.CARTAO]: 'vr_cartao',
  [FormaPagamento.CARNE]: 'vr_carne',
};

const ROTULOS: Array<[keyof ValoresPagamento, string]> = [
  ['dinheiro', 'Dinheiro'],
  ['pix', 'Pix'],
  ['cartao', 'Cartão'],
  ['carne', 'Carnê'],
  ['cheque', 'Cheque'],
  ['ticket', 'Ticket'],
];

export function rotulosFormas(valores: ValoresPagamento): string[] {
  return ROTULOS.filter(([chave]) => valores[chave] > 0).map(([, rotulo]) => rotulo);
}

export function mapearVenda(linha: LinhaVenda): VendaResumo {
  const pagamentos: ValoresPagamento = {
    dinheiro: numero(linha.vr_dinheiro),
    pix: numero(linha.vr_pix),
    cartao: numero(linha.vr_cartao),
    carne: numero(linha.vr_carne),
    cheque: numero(linha.vr_cheque),
    ticket: numero(linha.vr_ticket),
  };
  const idCliente = Number(linha.id_cliente ?? 0);
  return {
    id: Number(linha.id),
    controle: linha.controle,
    data: linha.data_venda,
    hora: horaDoControle(linha.controle),
    cliente: idCliente > 0 ? { id: idCliente, nome: linha.nome_cliente } : null,
    vendedor: linha.id_login ? { id: Number(linha.id_login), login: linha.login } : null,
    total: numero(linha.vr_total),
    desconto: numero(linha.vr_adicional),
    pagamentos,
    formasPagamento: rotulosFormas(pagamentos),
    estornada: Number(linha.estornado ?? 0) === 1,
    dataEstorno: linha.estornado_data,
    terminal: linha.terminal,
    turno: linha.turno,
  };
}
