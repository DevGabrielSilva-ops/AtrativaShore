import type { Papel, PapelEmpresa, StatusEmpresa } from '../plataforma/entities/papeis.js';

export const PERMISSOES = {
  'dashboard.ver': { grupo: 'Dashboard', descricao: 'Ver o dashboard comercial' },
  'vendas.registrar': { grupo: 'Vendas', descricao: 'Registrar vendas no PDV' },
  'vendas.consultar': { grupo: 'Vendas', descricao: 'Consultar as próprias vendas' },
  'vendas.consultar_todas': { grupo: 'Vendas', descricao: 'Consultar as vendas de todos os vendedores' },
  'vendas.estornar': { grupo: 'Vendas', descricao: 'Estornar vendas' },
  'caixa.operar': { grupo: 'Vendas', descricao: 'Abrir, consultar e fechar o caixa' },
  'carnes.consultar': { grupo: 'Carnês', descricao: 'Consultar parcelas de carnê' },
  'carnes.receber': { grupo: 'Carnês', descricao: 'Receber parcelas de carnê' },
  'clientes.consultar': { grupo: 'Clientes', descricao: 'Consultar clientes' },
  'clientes.gerenciar': { grupo: 'Clientes', descricao: 'Cadastrar e editar clientes' },
  'clientes.excluir': { grupo: 'Clientes', descricao: 'Excluir clientes' },
  'fornecedores.consultar': { grupo: 'Fornecedores', descricao: 'Consultar fornecedores' },
  'fornecedores.gerenciar': { grupo: 'Fornecedores', descricao: 'Cadastrar, editar e excluir fornecedores' },
  'produtos.consultar': { grupo: 'Produtos', descricao: 'Consultar produtos e preços' },
  'produtos.gerenciar': { grupo: 'Produtos', descricao: 'Cadastrar, editar e excluir produtos' },
  'estoque.consultar': { grupo: 'Estoque', descricao: 'Consultar saldos e movimentações' },
  'estoque.entrada': { grupo: 'Estoque', descricao: 'Registrar entradas de mercadoria' },
  'estoque.ajuste': { grupo: 'Estoque', descricao: 'Ajustar estoque (saídas e correções)' },
  'relatorios.vendas': { grupo: 'Relatórios', descricao: 'Relatórios de vendas, clientes e carnês' },
  'relatorios.estoque': { grupo: 'Relatórios', descricao: 'Relatórios de estoque e mercadorias' },
  'funcionarios.consultar': { grupo: 'Funcionários', descricao: 'Consultar funcionários' },
  'funcionarios.gerenciar': { grupo: 'Funcionários', descricao: 'Cadastrar funcionários, cargos e permissões' },
  'empresa.configurar': { grupo: 'Empresa', descricao: 'Alterar os dados da empresa' },
  'auditoria.consultar': { grupo: 'Empresa', descricao: 'Consultar o histórico de atividades' },
  'backup.gerar': { grupo: 'Empresa', descricao: 'Gerar e baixar backups dos dados da empresa' },
} as const;

export type Permissao = keyof typeof PERMISSOES;

export const TODAS_PERMISSOES = Object.keys(PERMISSOES) as Permissao[];

const GERENTE: Permissao[] = TODAS_PERMISSOES.filter(
  (p) => p !== 'funcionarios.gerenciar' && p !== 'empresa.configurar' && p !== 'backup.gerar',
);

export const PERMISSOES_POR_PAPEL: Record<PapelEmpresa, Permissao[]> = {
  COMPANY_ADMIN: TODAS_PERMISSOES,
  MANAGER: GERENTE,
  SELLER: [
    'vendas.registrar',
    'vendas.consultar',
    'caixa.operar',
    'carnes.consultar',
    'carnes.receber',
    'clientes.consultar',
    'produtos.consultar',
    'estoque.consultar',
  ],
  STOCK_OPERATOR: [
    'produtos.consultar',
    'fornecedores.consultar',
    'estoque.consultar',
    'estoque.entrada',
    'estoque.ajuste',
    'relatorios.estoque',
  ],
};

export const ROTULOS_PAPEL: Record<Papel, string> = {
  SUPER_ADMIN: 'Superadministrador',
  COMPANY_ADMIN: 'Administrador da empresa',
  MANAGER: 'Gerente',
  SELLER: 'Vendedor',
  STOCK_OPERATOR: 'Estoquista',
};

export function permissaoValida(valor: string): valor is Permissao {
  return Object.hasOwn(PERMISSOES, valor);
}

export function calcularPermissoes(papel: Papel, permissoesDoCargo?: string[] | null): Permissao[] {
  if (papel === 'SUPER_ADMIN') return [];
  if (papel === 'COMPANY_ADMIN') return [...TODAS_PERMISSOES];
  if (permissoesDoCargo) return permissoesDoCargo.filter(permissaoValida);
  return [...PERMISSOES_POR_PAPEL[papel]];
}

export function statusEfetivo(status: StatusEmpresa, assinaturaAte: string | null, hoje: string): StatusEmpresa {
  if (status === 'ACTIVE' && assinaturaAte && assinaturaAte < hoje) return 'EXPIRED';
  return status;
}

export const MENSAGEM_STATUS_EMPRESA: Record<Exclude<StatusEmpresa, 'ACTIVE'>, string> = {
  PENDING: 'A empresa ainda não foi ativada.',
  SUSPENDED: 'O acesso desta empresa está suspenso. Fale com o suporte do Atrativa Shore.',
  EXPIRED: 'A assinatura desta empresa expirou. Fale com o suporte do Atrativa Shore.',
};
