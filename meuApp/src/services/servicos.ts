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
  AdministradorPlataforma,
  Cargo,
  CatalogoPermissoes,
  CodigoAtivacao,
  CodigoGerado,
  ConclusaoAtivacao,
  EmpresaPlataforma,
  EmpresaPlataformaDetalhe,
  EstadoBancoEmpresa,
  Funcionario,
  FuncionarioEntrada,
  IndicadoresPlataforma,
  PapelEmpresa,
  Permissao,
  Plano,
  RegistroAuditoria,
  SituacaoCodigo,
  StatusEmpresa,
  StatusUsuario,
  TipoCodigo,
  ValidacaoCodigo,
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
  login: (login: string, senha: string, lembrar: boolean) =>
    api.post<RespostaLogin>('/auth/login', { login, senha, lembrar }, { ignorarSessaoExpirada: true }),
  renovar: () => api.post<RespostaLogin>('/auth/refresh', {}, { ignorarSessaoExpirada: true, semRenovar: true }),
  sair: () => api.post<void>('/auth/logout', {}, { ignorarSessaoExpirada: true, semRenovar: true }),
  me: () => api.get<UsuarioAutenticado>('/auth/me'),
  alterarSenha: (senhaAtual: string, novaSenha: string) =>
    api.patch<RespostaLogin>('/auth/senha', { senhaAtual, novaSenha }),
};

export const saudeService = {
  verificar: () => api.get<Saude>('/health'),
  estadoEmpresa: () => api.get<EstadoBancoEmpresa>('/empresa/estado-banco'),
};

export interface FiltroAuditoria extends Pagina, FiltroPeriodo {
  idUsuario?: number;
  acao?: string;
}

export const ativacaoService = {
  validar: (codigo: string) =>
    api.post<ValidacaoCodigo>('/ativacao/validar', { codigo }, { ignorarSessaoExpirada: true, semRenovar: true }),
  concluir: (dados: {
    codigo: string;
    responsavel: { nome: string; email: string; login?: string; senha: string };
    empresa?: Record<string, string | undefined>;
  }) => api.post<ConclusaoAtivacao>('/ativacao/concluir', dados, { ignorarSessaoExpirada: true, semRenovar: true }),
};

export const funcionarioService = {
  catalogo: () => api.get<CatalogoPermissoes>('/funcionarios/catalogo'),
  listar: (filtro: Pagina & { busca?: string; status?: StatusUsuario; papel?: PapelEmpresa } = {}) =>
    api.get<Paginado<Funcionario>>('/funcionarios', { ...filtro }),
  criar: (dados: FuncionarioEntrada) =>
    api.post<{ funcionario: Funcionario; senhaTemporaria: string | null }>('/funcionarios', dados),
  atualizar: (id: number, dados: Partial<FuncionarioEntrada>) => api.patch<Funcionario>(`/funcionarios/${id}`, dados),
  alterarStatus: (id: number, status: StatusUsuario) => api.post<Funcionario>(`/funcionarios/${id}/status`, { status }),
  senhaTemporaria: (id: number) => api.post<{ senhaTemporaria: string }>(`/funcionarios/${id}/senha-temporaria`),
  atividades: (id: number, filtro: FiltroAuditoria = {}) =>
    api.get<Paginado<RegistroAuditoria>>(`/funcionarios/${id}/atividades`, { ...filtro }),
  cargos: () => api.get<Cargo[]>('/cargos'),
  criarCargo: (dados: { nome: string; papelBase: PapelEmpresa; permissoes: Permissao[] }) => api.post<Cargo>('/cargos', dados),
  atualizarCargo: (id: number, dados: { nome: string; papelBase: PapelEmpresa; permissoes: Permissao[] }) =>
    api.patch<Cargo>(`/cargos/${id}`, dados),
  removerCargo: (id: number) => api.delete(`/cargos/${id}`),
};

export const auditoriaService = {
  listar: (filtro: FiltroAuditoria = {}) => api.get<Paginado<RegistroAuditoria>>('/auditoria', { ...filtro }),
};

export const plataformaService = {
  indicadores: () => api.get<IndicadoresPlataforma>('/plataforma/indicadores'),
  empresas: (filtro: Pagina & { busca?: string; status?: StatusEmpresa } = {}) =>
    api.get<Paginado<EmpresaPlataforma>>('/plataforma/empresas', { ...filtro }),
  empresa: (id: number) => api.get<EmpresaPlataformaDetalhe>(`/plataforma/empresas/${id}`),
  criarEmpresa: (dados: Record<string, string | number | null | undefined>) =>
    api.post<EmpresaPlataforma>('/plataforma/empresas', dados),
  atualizarEmpresa: (id: number, dados: { nome?: string; idPlano?: number; assinaturaAte?: string | null }) =>
    api.patch<EmpresaPlataforma>(`/plataforma/empresas/${id}`, dados),
  alterarStatus: (id: number, dados: { status: 'ACTIVE' | 'SUSPENDED'; motivo?: string; assinaturaAte?: string }) =>
    api.post<EmpresaPlataforma>(`/plataforma/empresas/${id}/status`, dados),
  senhaUsuario: (idEmpresa: number, idUsuario: number) =>
    api.post<{ senhaTemporaria: string }>(`/plataforma/empresas/${idEmpresa}/usuarios/${idUsuario}/senha-temporaria`),
  planos: () => api.get<Plano[]>('/plataforma/planos'),
  criarPlano: (dados: { nome: string; descricao?: string; maxFuncionarios?: number | null; ativo?: boolean }) =>
    api.post<Plano>('/plataforma/planos', dados),
  atualizarPlano: (id: number, dados: { nome: string; descricao?: string; maxFuncionarios?: number | null; ativo?: boolean }) =>
    api.patch<Plano>(`/plataforma/planos/${id}`, dados),
  codigos: (filtro: Pagina & { situacao?: SituacaoCodigo; idEmpresa?: number } = {}) =>
    api.get<Paginado<CodigoAtivacao>>('/plataforma/codigos', { ...filtro }),
  gerarCodigo: (dados: {
    tipo: TipoCodigo;
    idEmpresa?: number;
    emailDestinatario?: string;
    validadeDias?: number;
    maxUsos?: number;
    observacao?: string;
  }) => api.post<CodigoGerado>('/plataforma/codigos', dados),
  revogarCodigo: (id: number) => api.post<CodigoAtivacao>(`/plataforma/codigos/${id}/revogar`),
  administradores: () => api.get<AdministradorPlataforma[]>('/plataforma/administradores'),
  criarAdministrador: (dados: { nome: string; email: string }) =>
    api.post<{ id: number; nome: string; email: string; senhaTemporaria: string }>('/plataforma/administradores', dados),
  statusAdministrador: (id: number, status: StatusUsuario) =>
    api.post<AdministradorPlataforma>(`/plataforma/administradores/${id}/status`, { status }),
  senhaAdministrador: (id: number) => api.post<{ senhaTemporaria: string }>(`/plataforma/administradores/${id}/senha-temporaria`),
  auditoria: (filtro: FiltroAuditoria & { idEmpresa?: number } = {}) =>
    api.get<Paginado<RegistroAuditoria>>('/plataforma/auditoria', { ...filtro }),
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
