/**
 * Tipos das respostas da API (espelham os services do backend NestJS em
 * atrativa-shore-api/atrativa-api/src). Não invente campos aqui: se a API
 * mudar, ajuste a partir do Swagger (/api/v1/docs).
 */

export interface Meta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Paginado<T> {
  data: T[];
  meta: Meta;
}

export interface Periodo {
  inicio: string;
  fim: string;
}

export type FormaPagamento = 'DINHEIRO' | 'PIX' | 'CARTAO' | 'CARNE';

// ------------------------------------------------------------------ auth
export interface UsuarioAutenticado {
  id: number;
  login: string;
  idPerfil: number;
  perfil: string | null;
  administrador: boolean;
}

export interface RespostaLogin {
  accessToken: string;
  tokenType: 'Bearer';
  expiresAt: string;
  usuario: UsuarioAutenticado;
}

// ------------------------------------------------------------------ empresa
export interface Empresa {
  id: number;
  nome: string | null;
  endereco: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
  cnpj: string | null;
  ie: string | null;
  im: string | null;
  telefone: string | null;
  fax: string | null;
  email: string | null;
  site: string | null;
  mensagem: string | null;
  qtdTerminal: number | null;
  qtdTurnos: string;
  maxDesconto: number | null;
  fracionado: number | null;
}

// ------------------------------------------------------------------ clientes
export interface Cliente {
  id: number;
  nome: string | null;
  cpf: string | null;
  rg: string | null;
  ie: string | null;
  telefone: string | null;
  celular: string | null;
  email: string | null;
  endereco: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
  codigo: string | null;
  dataAniversario: string | null;
  faixaSalarial: number | null;
  informacoesAdicionais: string | null;
  /** Limite manual do carnê; null = calculado pela renda. */
  limiteCarne: number | null;
}

/** GET /clientes/:id/credito-carne */
export interface CreditoCarne {
  idCliente: number;
  limite: number;
  origem: 'MANUAL' | 'RENDA' | 'PADRAO';
  emAberto: number;
  disponivel: number;
  faixaSalarial: number | null;
  percentualRenda: number;
}

export type ClienteEntrada = Partial<Omit<Cliente, 'id' | 'codigo'>> & { nome: string };

// ------------------------------------------------------------------ fornecedores
export interface Fornecedor {
  id: number;
  nome: string | null;
  cnpj: string | null;
  ie: string | null;
  contato: string | null;
  email: string | null;
  telefone: string | null;
  fax: string | null;
  rua: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
}

export type FornecedorEntrada = Partial<Omit<Fornecedor, 'id'>> & { nome: string };

// ------------------------------------------------------------------ produtos
export interface Produto {
  id: number;
  nome: string | null;
  codigoBarras: string | null;
  valorCompra: number | null;
  precoVista: number | null;
  precoPrazo: number | null;
  lucroBrutoPercentual: number | null;
  estoqueMinimo: number | null;
  quantidadeEstoque: number | null;
  controlaEstoque: boolean;
  unidade: string | null;
  informacoesAdicionais: string | null;
  tipo: { id: number; nome: string | null } | null;
  fornecedor: { id: number; nome: string | null } | null;
}

export interface ProdutoEntrada {
  nome: string;
  codigoBarras?: string;
  valorCompra?: number;
  precoVista: number;
  precoPrazo?: number;
  estoqueMinimo?: number;
  idFornecedor?: number;
  idTipo?: number;
  unidade?: string;
  informacoesAdicionais?: string;
}

export interface ProdutoTipo {
  id: number;
  nome: string | null;
}

// ------------------------------------------------------------------ estoque
export type TipoMovimentacao = 'ENTRADA' | 'TROCA' | 'AJUSTE_ENTRADA' | 'AJUSTE_SAIDA' | 'VENDA';

export interface Movimentacao {
  origem: 'HISTORICO' | 'VENDA';
  id: number;
  data: string | null;
  controle: string | null;
  tipo: TipoMovimentacao;
  idProduto: number | null;
  produto: string;
  quantidade: number;
  valorUnitario: number | null;
  documento: string | null;
}

export interface ResultadoEntrada {
  controle: string;
  numeroNota: string;
  dataLancamento: string;
  valorTotal: number;
  itens: Array<{ idProduto: number; produto: string | null; quantidade: number; valorCompra: number; saldoAtual: number }>;
}

export type MotivoAjuste = 'PERDA' | 'AVARIA' | 'CONTAGEM' | 'DEVOLUCAO' | 'USO' | 'OUTRO';

// ------------------------------------------------------------------ vendas
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

export interface ItemVendido {
  id: number;
  idProduto: number | null;
  produto: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
}

export interface ParcelaCarneResumo {
  codigo: string | null;
  parcela: number;
  vencimento: string | null;
  valor: number;
  situacao: 'ABERTA' | 'PAGA' | 'ESTORNADA';
  dataPagamento: string | null;
  valorPago: number | null;
}

export interface VendaDetalhe extends VendaResumo {
  subtotalItens: number;
  creditoTroca: number;
  itens: ItemVendido[];
  itensTroca: ItemVendido[];
  parcelasCarne: ParcelaCarneResumo[];
}

export interface ItemVendaEntrada {
  idProduto: number;
  quantidade: number;
  precoUnitario?: number;
}

export interface RegistrarVendaEntrada {
  idCliente?: number;
  itens: ItemVendaEntrada[];
  itensTroca?: ItemVendaEntrada[];
  desconto?: number;
  acrescimo?: number;
  pagamentos: Array<{ forma: FormaPagamento; valor: number }>;
  parcelasCarne?: number;
  primeiroVencimento?: string;
}

// ------------------------------------------------------------------ carnês
export interface ParcelaCarne {
  id: number;
  codigo: string | null;
  controleVenda: string | null;
  cliente: { id: number; nome: string | null; telefone: string | null; celular: string | null } | null;
  parcela: number;
  totalParcelas: number;
  numeroParcela: string;
  dataCompra: string | null;
  vencimento: string | null;
  valorParcela: number;
  valorTotalCompra: number | null;
  valorParcelado: number | null;
  situacao: 'ABERTA' | 'PAGA';
  atrasada: boolean;
  dataPagamento: string | null;
  valorPago: number | null;
  juros: number | null;
  desconto: number | null;
}

export interface ResultadoBaixa {
  controleRecebimento: string;
  dataPagamento: string;
  valorTotal: number;
  parcelas: ParcelaCarne[];
}

// ------------------------------------------------------------------ caixa
export interface Caixa {
  id: number;
  terminal: string | null;
  turno: string | null;
  aberto: boolean;
  idLogin: number | null;
  abertura: { data: string | null; hora: string | null; valor: number | null };
  fechamento: { data: string | null; hora: string | null; valor: number | null };
}

export interface MovimentoCaixa {
  tipo: 'VENDA' | 'RECEBIMENTO_CARNE';
  controle: string | null;
  data: string | null;
  hora: string | null;
  descricao: string;
  valor: number;
}

export interface ResumoCaixa {
  periodo: Periodo;
  quantidadeVendas: number;
  vendas: { dinheiro: number; pix: number; cartao: number; carne: number; outros: number; total: number };
  descontos: number;
  recebimentosCarne: { quantidade: number; total: number };
  totalRecebido: number;
  dinheiroEsperadoNaGaveta: number;
  movimentos: MovimentoCaixa[];
}

export type CaixaComResumo = Caixa & { resumo: ResumoCaixa };

// ------------------------------------------------------------------ relatórios
export interface FormasValores {
  dinheiro: number;
  pix: number;
  cartao: number;
  carne: number;
  outros: number;
}

export interface Dashboard {
  periodo: Periodo;
  faturamento: number;
  quantidadeVendas: number;
  ticketMedio: number;
  descontos: number;
  itensVendidos: number;
  clientesAtendidos: number;
  formasPagamento: FormasValores;
  recebimentosCarne: { quantidade: number; total: number };
  carneEmAberto: { parcelas: number; total: number; parcelasVencidas: number; totalVencido: number };
  produtosEstoqueBaixo: number;
  comparativo: {
    periodoAnterior: Periodo;
    faturamentoAnterior: number;
    quantidadeVendasAnterior: number;
    variacaoFaturamentoPercentual: number | null;
    variacaoQuantidadePercentual: number | null;
  };
}

export interface Faturamento {
  periodo: Periodo;
  agrupamento: 'dia' | 'mes';
  total: number;
  serie: Array<{ periodo: string; quantidadeVendas: number; faturamento: number; descontos: number }>;
}

export interface VendasPeriodo extends Paginado<VendaResumo> {
  resumo: {
    periodo: Periodo;
    quantidadeVendas: number;
    faturamento: number;
    descontos: number;
    formasPagamento: FormasValores;
  };
}

export interface FormasPagamentoRelatorio {
  periodo: Periodo;
  total: number;
  formas: Array<{ forma: keyof FormasValores; valor: number; percentual: number }>;
}

export interface MaisVendidos {
  periodo: Periodo;
  produtos: Array<{
    posicao: number;
    idProduto: number;
    produto: string;
    codigoBarras: string | null;
    quantidade: number;
    valor: number;
    vendas: number;
  }>;
}

export interface VendasPorCliente {
  periodo: Periodo;
  clientes: Array<{
    posicao: number;
    idCliente: number;
    cliente: string;
    quantidadeVendas: number;
    total: number;
    ticketMedio: number;
    ultimaCompra: string | null;
  }>;
}

export interface ClienteDebito {
  idCliente: number;
  cliente: string;
  telefone: string | null;
  celular: string | null;
  parcelasEmAberto: number;
  valorEmAberto: number;
  parcelasVencidas: number;
  valorVencido: number;
  proximoVencimento: string | null;
}

export interface ClientesDebito extends Paginado<ClienteDebito> {
  resumo: { valorTotalEmAberto: number };
}

export interface BaixaCarne {
  id: number;
  codigo: string | null;
  parcela: number;
  data: string | null;
  vencimento: string | null;
  idCliente: number;
  cliente: string | null;
  valorParcela: number;
  juros: number | null;
  desconto: number | null;
  valorPago: number;
}

export interface BaixasCarne extends Paginado<BaixaCarne> {
  resumo: { periodo: Periodo; quantidade: number; total: number };
}

export interface Mercadoria {
  id: number;
  dataCadastro: string | null;
  numeroNota: string | null;
  idProduto: number;
  produto: string;
  fornecedor: string | null;
  quantidade: number;
  valorCompra: number;
  investimento: number;
}

export interface Mercadorias extends Paginado<Mercadoria> {
  resumo: { periodo: Periodo; lancamentos: number; itens: number; investimento: number };
}

export interface Saude {
  status: string;
  banco: string;
  migrations: {
    tabelasInnodb: boolean;
    tabelasAindaMyisam: string[];
    apiCredencial: boolean;
    colunaVrPix: boolean;
    colunaLimiteCarne: boolean;
  };
}
