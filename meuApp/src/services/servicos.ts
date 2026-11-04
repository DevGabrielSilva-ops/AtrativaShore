import type {
  BaixasCarne,
  CaixaComResumo,
  Caixa,
  Cliente,
  ClienteEntrada,
  ClientesDebito,
  Dashboard,
  Empresa,
  Faturamento,
  FormaPagamento,
  FormasPagamentoRelatorio,
  Fornecedor,
  FornecedorEntrada,
  MaisVendidos,
  Mercadorias,
  MotivoAjuste,
  Movimentacao,
  Paginado,
  ParcelaCarne,
  Produto,
  ProdutoEntrada,
  ProdutoTipo,
  RegistrarVendaEntrada,
  RespostaLogin,
  ResultadoBaixa,
  ResultadoEntrada,
  Saude,
  TipoMovimentacao,
  UsuarioAutenticado,
  VendaDetalhe,
  VendaResumo,
  VendasPeriodo,
  VendasPorCliente,
  CreditoCarne,
} from '../types/api';
import { api } from './api';

export interface Pagina {
  page?: number;
  limit?: number;
}

export interface FiltroPeriodo {
  inicio?: string;
  fim?: string;
}

export const authService = {
  login: (login: string, senha: string) =>
    api.post<RespostaLogin>('/auth/login', { login, senha }, { ignorarSessaoExpirada: true }),
  me: () => api.get<UsuarioAutenticado>('/auth/me'),
  alterarSenha: (senhaAtual: string, novaSenha: string) => api.patch<void>('/auth/senha', { senhaAtual, novaSenha }),
};

export const saudeService = {
  verificar: () => api.get<Saude>('/health'),
};

export const empresaService = {
  obter: () => api.get<Empresa>('/empresa'),
  atualizar: (dados: Partial<Empresa>) => api.patch<Empresa>('/empresa', dados),
};

export const clienteService = {
  listar: (filtro: Pagina & { busca?: string } = {}) => api.get<Paginado<Cliente>>('/clientes', { ...filtro }),
  obter: (id: number) => api.get<Cliente>(`/clientes/${id}`),
  creditoCarne: (id: number) => api.get<CreditoCarne>(`/clientes/${id}/credito-carne`),
  criar: (dados: ClienteEntrada) => api.post<Cliente>('/clientes', dados),
  atualizar: (id: number, dados: Partial<ClienteEntrada>) => api.patch<Cliente>(`/clientes/${id}`, dados),
  remover: (id: number) => api.delete(`/clientes/${id}`),
  vendas: (id: number, filtro: Pagina & FiltroPeriodo = {}) =>
    api.get<Paginado<VendaResumo>>(`/clientes/${id}/vendas`, { ...filtro }),
};

export const fornecedorService = {
  listar: (filtro: Pagina & { busca?: string } = {}) => api.get<Paginado<Fornecedor>>('/fornecedores', { ...filtro }),
  criar: (dados: FornecedorEntrada) => api.post<Fornecedor>('/fornecedores', dados),
  atualizar: (id: number, dados: Partial<FornecedorEntrada>) => api.patch<Fornecedor>(`/fornecedores/${id}`, dados),
  remover: (id: number) => api.delete(`/fornecedores/${id}`),
};

export interface FiltroProdutos extends Pagina {
  busca?: string;
  idFornecedor?: number;
  somenteDisponiveis?: boolean;
}

export const produtoService = {
  listar: (filtro: FiltroProdutos = {}) => api.get<Paginado<Produto>>('/produtos', { ...filtro }),
  obter: (id: number) => api.get<Produto>(`/produtos/${id}`),
  porCodigo: (codigo: string) => api.get<Produto>(`/produtos/codigo/${encodeURIComponent(codigo)}`),
  estoqueBaixo: (filtro: Pagina & { limite?: number } = {}) =>
    api.get<Paginado<Produto>>('/produtos/estoque-baixo', { ...filtro }),
  tipos: () => api.get<ProdutoTipo[]>('/produtos/tipos'),
  criar: (dados: ProdutoEntrada) => api.post<Produto>('/produtos', dados),
  atualizar: (id: number, dados: Partial<ProdutoEntrada>) => api.patch<Produto>(`/produtos/${id}`, dados),
  remover: (id: number) => api.delete(`/produtos/${id}`),
};

export interface FiltroMovimentacoes extends Pagina, FiltroPeriodo {
  idProduto?: number;
  tipo?: TipoMovimentacao;
}

export const estoqueService = {
  saldo: (idProduto: number) =>
    api.get<Produto & { ultimasMovimentacoes: Movimentacao[] }>(`/estoque/${idProduto}`),
  movimentacoes: (filtro: FiltroMovimentacoes = {}) =>
    api.get<Paginado<Movimentacao>>('/estoque/movimentacoes', { ...filtro }),
  registrarEntrada: (dados: {
    numeroNota?: string;
    idFornecedor?: number;
    dataLancamento?: string;
    vencimento?: string;
    atualizarValorCompra?: boolean;
    itens: Array<{ idProduto: number; quantidade: number; valorCompra?: number }>;
  }) => api.post<ResultadoEntrada>('/estoque/entradas', dados),
  registrarAjuste: (dados: { idProduto: number; quantidade: number; motivo: MotivoAjuste }) =>
    api.post<Produto>('/estoque/ajustes', dados),
};

export interface FiltroVendas extends Pagina, FiltroPeriodo {
  idCliente?: number;
  formaPagamento?: FormaPagamento;
  incluirEstornadas?: boolean;
  ordem?: 'recentes' | 'antigas';
}

export const vendaService = {
  registrar: (dados: RegistrarVendaEntrada) => api.post<VendaDetalhe>('/vendas', dados),
  listar: (filtro: FiltroVendas = {}) => api.get<Paginado<VendaResumo>>('/vendas', { ...filtro }),
  obter: (id: number) => api.get<VendaDetalhe>(`/vendas/${id}`),
  estornar: (id: number) => api.post<VendaDetalhe>(`/vendas/${id}/estorno`),
};

export const carneService = {
  listar: (filtro: Pagina & FiltroPeriodo & { idCliente?: number; situacao?: 'ABERTA' | 'PAGA' | 'TODAS'; vencidas?: boolean } = {}) =>
    api.get<Paginado<ParcelaCarne>>('/carnes', { ...filtro }),
  obter: (codigo: string) => api.get<ParcelaCarne>(`/carnes/${codigo}`),
  baixar: (dados: { parcelas: Array<{ codigo: string; juros?: number; desconto?: number }>; dataPagamento?: string }) =>
    api.post<ResultadoBaixa>('/carnes/baixa', dados),
};

export const caixaService = {
  atual: () => api.get<CaixaComResumo | null>('/caixa/atual'),
  abrir: (valorAbertura: number) => api.post<CaixaComResumo>('/caixa/abrir', { valorAbertura }),
  fechar: (valorProximoDia?: number) =>
    api.post<CaixaComResumo & { valorProximoDia: number | null }>('/caixa/fechar', { valorProximoDia }),
  historico: (filtro: Pagina = {}) => api.get<Paginado<Caixa>>('/caixa/historico', { ...filtro }),
  obter: (id: number) => api.get<CaixaComResumo>(`/caixa/${id}`),
};

export const relatorioService = {
  dashboard: (periodo: FiltroPeriodo = {}) => api.get<Dashboard>('/relatorios/dashboard', { ...periodo }),
  faturamento: (filtro: FiltroPeriodo & { agrupar?: 'dia' | 'mes' } = {}) =>
    api.get<Faturamento>('/relatorios/faturamento', { ...filtro }),
  vendasPeriodo: (filtro: Pagina & FiltroPeriodo & { formaPagamento?: FormaPagamento } = {}) =>
    api.get<VendasPeriodo>('/relatorios/vendas-periodo', { ...filtro }),
  vendasDia: (data?: string) => api.get<VendasPeriodo>('/relatorios/vendas-dia', { data }),
  formasPagamento: (periodo: FiltroPeriodo = {}) =>
    api.get<FormasPagamentoRelatorio>('/relatorios/formas-pagamento', { ...periodo }),
  maisVendidos: (filtro: FiltroPeriodo & { limite?: number; ordenarPor?: 'quantidade' | 'valor' } = {}) =>
    api.get<MaisVendidos>('/relatorios/produtos-mais-vendidos', { ...filtro }),
  vendasPorCliente: (filtro: FiltroPeriodo & { limite?: number; incluirNaoIdentificado?: boolean } = {}) =>
    api.get<VendasPorCliente>('/relatorios/vendas-por-cliente', { ...filtro }),
  estoqueBaixo: (filtro: Pagina & { limite?: number } = {}) =>
    api.get<Paginado<Produto>>('/relatorios/estoque-baixo', { ...filtro }),
  clientesDebito: (filtro: Pagina = {}) => api.get<ClientesDebito>('/relatorios/clientes-debito', { ...filtro }),
  baixasCarne: (filtro: Pagina & FiltroPeriodo = {}) => api.get<BaixasCarne>('/relatorios/baixas-carne', { ...filtro }),
  mercadorias: (filtro: Pagina & FiltroPeriodo = {}) => api.get<Mercadorias>('/relatorios/mercadorias', { ...filtro }),
  movimentacoes: (filtro: FiltroMovimentacoes = {}) =>
    api.get<Paginado<Movimentacao>>('/relatorios/movimentacoes', { ...filtro }),
};
