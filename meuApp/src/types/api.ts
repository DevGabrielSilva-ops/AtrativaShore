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

export type Papel = 'SUPER_ADMIN' | 'COMPANY_ADMIN' | 'MANAGER' | 'SELLER' | 'STOCK_OPERATOR';
export type PapelEmpresa = Exclude<Papel, 'SUPER_ADMIN'>;
export type StatusEmpresa = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'EXPIRED';
export type StatusUsuario = 'ACTIVE' | 'INACTIVE';

export type Permissao =
  | 'dashboard.ver'
  | 'vendas.registrar'
  | 'vendas.consultar'
  | 'vendas.consultar_todas'
  | 'vendas.estornar'
  | 'caixa.operar'
  | 'carnes.consultar'
  | 'carnes.receber'
  | 'clientes.consultar'
  | 'clientes.gerenciar'
  | 'clientes.excluir'
  | 'fornecedores.consultar'
  | 'fornecedores.gerenciar'
  | 'produtos.consultar'
  | 'produtos.gerenciar'
  | 'estoque.consultar'
  | 'estoque.entrada'
  | 'estoque.ajuste'
  | 'relatorios.vendas'
  | 'relatorios.estoque'
  | 'funcionarios.consultar'
  | 'funcionarios.gerenciar'
  | 'empresa.configurar'
  | 'auditoria.consultar';

export interface UsuarioAutenticado {
  id: number;
  nome: string;
  email: string | null;
  login: string | null;
  papel: Papel;
  idCargo: number | null;
  cargo: string | null;
  permissoes: Permissao[];
  idEmpresa: number | null;
  empresa: { id: number; nome: string; status: StatusEmpresa } | null;
  idLogin: number | null;
  trocarSenha: boolean;
  administrador: boolean;
}

export interface RespostaLogin {
  accessToken: string;
  tokenType: 'Bearer';
  expiresAt: string;
  usuario: UsuarioAutenticado;
}

export interface Funcionario {
  id: number;
  nome: string;
  email: string | null;
  login: string | null;
  papel: PapelEmpresa;
  papelRotulo: string;
  cargo: { id: number; nome: string } | null;
  permissoes: Permissao[];
  status: StatusUsuario;
  trocarSenha: boolean;
  ultimoLoginEm: string | null;
  criadoEm: string;
  idLogin: number | null;
}

export interface FuncionarioEntrada {
  nome: string;
  email?: string | null;
  login?: string | null;
  papel: PapelEmpresa;
  idCargo?: number | null;
  senha?: string;
}

export interface Cargo {
  id: number;
  idEmpresa: number;
  nome: string;
  papelBase: PapelEmpresa;
  permissoes: Permissao[];
  criadoEm: string;
  funcionarios?: number;
}

export interface CatalogoPermissoes {
  papeis: Array<{ id: PapelEmpresa; rotulo: string; permissoes: Permissao[] }>;
  permissoes: Array<{ id: Permissao; grupo: string; descricao: string }>;
}

export interface RegistroAuditoria {
  id: string;
  dataHora: string;
  acao: string;
  entidade: string | null;
  idEntidade: string | null;
  detalhes: Record<string, unknown> | null;
  ip: string | null;
  idEmpresa: number | null;
  usuario: { id: number; nome: string } | null;
}

export type TipoCodigo = 'NOVA_EMPRESA' | 'EMPRESA_EXISTENTE';
export type SituacaoCodigo = 'ATIVO' | 'USADO' | 'EXPIRADO' | 'REVOGADO';

export interface CodigoAtivacao {
  id: number;
  prefixo: string;
  tipo: TipoCodigo;
  idEmpresa: number | null;
  emailDestinatario: string | null;
  observacao: string | null;
  maxUsos: number;
  usos: number;
  expiraEm: string;
  revogadoEm: string | null;
  ultimoUsoEm: string | null;
  criadoEm: string;
  situacao: SituacaoCodigo;
  empresa?: { id: number; nome: string | null } | null;
}

export interface CodigoGerado extends CodigoAtivacao {
  codigo: string;
}

export interface Plano {
  id: number;
  nome: string;
  descricao: string | null;
  maxFuncionarios: number | null;
  ativo: boolean;
  criadoEm: string;
}

export interface EmpresaPlataforma {
  id: number;
  nome: string;
  cnpj: string | null;
  email: string | null;
  telefone: string | null;
  cidade: string | null;
  uf: string | null;
  status: StatusEmpresa;
  motivoStatus: string | null;
  plano: { id: number; nome: string } | null;
  assinaturaAte: string | null;
  bancoProvisionado: boolean;
  usuarios: number;
  usuariosAtivos: number;
  criadaEm: string;
  ativadaEm: string | null;
  suspensaEm: string | null;
}

export interface EmpresaPlataformaDetalhe extends EmpresaPlataforma {
  administradores: Array<{ id: number; nome: string; email: string | null; login: string | null; status: StatusUsuario; ultimoLoginEm: string | null }>;
  funcionariosPorPapel: Partial<Record<PapelEmpresa, number>>;
  ativacoes: Array<{ id: number; dataHora: string; usuario: string }>;
  codigos: CodigoAtivacao[];
}

export interface IndicadoresPlataforma {
  empresas: { total: number } & Record<StatusEmpresa, number>;
  usuarios: { total: number; ativos: number; porPapel: Partial<Record<PapelEmpresa, number>> };
  ativacoes: number;
  codigosAtivos: number;
  empresasRecentes: EmpresaPlataforma[];
}

export interface AdministradorPlataforma {
  id: number;
  nome: string;
  email: string | null;
  status: StatusUsuario;
  trocarSenha: boolean;
  ultimoLoginEm: string | null;
  criadoEm: string;
}

export interface ValidacaoCodigo {
  tipo: TipoCodigo;
  expiraEm: string;
  empresa: { nome: string } | null;
  emailDestinatario: string | null;
}

export interface ConclusaoAtivacao {
  empresa: { id: number; nome: string };
  usuario: { id: number; nome: string; email: string | null; login: string | null };
}

export interface EstadoBancoEmpresa {
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
  limiteCarne: number | null;
}

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
  plataformaMigrada: boolean;
}
