import type {
  CreditoCarne,
  FormaPagamento,
  FormasValores,
  MotivoAjuste,
  Papel,
  PapelEmpresa,
  SituacaoCodigo,
  StatusEmpresa,
  TipoMovimentacao,
} from '../types/api';

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

export const ROTULOS_PAPEL: Record<Papel, string> = {
  SUPER_ADMIN: 'Superadministrador',
  COMPANY_ADMIN: 'Administrador da empresa',
  MANAGER: 'Gerente',
  SELLER: 'Vendedor',
  STOCK_OPERATOR: 'Estoquista',
};

export const PAPEIS_EMPRESA: PapelEmpresa[] = ['COMPANY_ADMIN', 'MANAGER', 'SELLER', 'STOCK_OPERATOR'];

export const ROTULOS_STATUS_EMPRESA: Record<StatusEmpresa, string> = {
  PENDING: 'Aguardando ativação',
  ACTIVE: 'Ativa',
  SUSPENDED: 'Suspensa',
  EXPIRED: 'Assinatura vencida',
};

export const TOM_STATUS_EMPRESA: Record<StatusEmpresa, 'sucesso' | 'aviso' | 'perigo' | 'neutro'> = {
  PENDING: 'aviso',
  ACTIVE: 'sucesso',
  SUSPENDED: 'perigo',
  EXPIRED: 'perigo',
};

export const ROTULOS_SITUACAO_CODIGO: Record<SituacaoCodigo, string> = {
  ATIVO: 'Disponível',
  USADO: 'Utilizado',
  EXPIRADO: 'Expirado',
  REVOGADO: 'Revogado',
};

export const TOM_SITUACAO_CODIGO: Record<SituacaoCodigo, 'sucesso' | 'aviso' | 'perigo' | 'neutro'> = {
  ATIVO: 'sucesso',
  USADO: 'neutro',
  EXPIRADO: 'aviso',
  REVOGADO: 'perigo',
};

const ROTULOS_ACAO: Record<string, string> = {
  'auth.login': 'Entrou no sistema',
  'auth.login_falhou': 'Tentativa de login recusada',
  'auth.logout': 'Saiu do sistema',
  'auth.senha_alterada': 'Trocou a senha',
  'auth.refresh_reutilizado': 'Sessão encerrada por reuso de credencial',
  'venda.registrar': 'Registrou venda',
  'venda.estornar': 'Estornou venda',
  'caixa.abrir': 'Abriu o caixa',
  'caixa.fechar': 'Fechou o caixa',
  'carne.receber': 'Recebeu parcelas de carnê',
  'cliente.criar': 'Cadastrou cliente',
  'cliente.atualizar': 'Alterou cliente',
  'cliente.excluir': 'Excluiu cliente',
  'fornecedor.criar': 'Cadastrou fornecedor',
  'fornecedor.atualizar': 'Alterou fornecedor',
  'fornecedor.excluir': 'Excluiu fornecedor',
  'produto.criar': 'Cadastrou produto',
  'produto.atualizar': 'Alterou produto',
  'produto.excluir': 'Excluiu produto',
  'estoque.entrada': 'Lançou entrada de estoque',
  'estoque.ajuste': 'Ajustou estoque',
  'empresa.atualizar': 'Alterou dados da empresa',
  'backup.gerado': 'Gerou backup dos dados',
  'backup.baixado': 'Baixou backup dos dados',
  'backup.falhou': 'Falha ao gerar backup',
  'backup.restaurado': 'Restaurou um backup',
  'backup.restauracao_falhou': 'Falha ao restaurar backup',
  'funcionario.importado': 'Funcionário importado do sistema anterior',
  'empresa.ativada': 'Ativou a empresa',
  'empresa.ativacao_falhou': 'Falha na ativação',
  'funcionario.criar': 'Cadastrou funcionário',
  'funcionario.atualizar': 'Alterou funcionário',
  'funcionario.permissoes_alteradas': 'Alterou cargo ou permissões',
  'funcionario.ativar': 'Reativou funcionário',
  'funcionario.desativar': 'Desativou funcionário',
  'funcionario.senha_redefinida': 'Gerou senha temporária',
  'cargo.criar': 'Criou cargo',
  'cargo.permissoes_alteradas': 'Alterou permissões de cargo',
  'cargo.excluir': 'Excluiu cargo',
  'plataforma.empresa_criada': 'Cadastrou empresa',
  'plataforma.empresa_atualizada': 'Alterou empresa',
  'plataforma.empresa_ativada': 'Ativou empresa',
  'plataforma.empresa_suspensa': 'Suspendeu empresa',
  'plataforma.codigo_gerado': 'Gerou código de ativação',
  'plataforma.codigo_revogado': 'Revogou código de ativação',
  'plataforma.plano_criado': 'Criou plano',
  'plataforma.plano_atualizado': 'Alterou plano',
  'plataforma.admin_criado': 'Criou superadministrador',
  'plataforma.admin_ativado': 'Reativou superadministrador',
  'plataforma.admin_desativado': 'Desativou superadministrador',
  'cli.superadmin_criado': 'Superadministrador provisionado',
  'cli.superadmin_senha': 'Senha do superadministrador redefinida',
  'cli.empresa_importada': 'Empresa importada do sistema anterior',
  'cli.usuario_importado': 'Usuário importado do sistema anterior',
};

export function rotuloAcao(acao: string): string {
  return ROTULOS_ACAO[acao] ?? acao;
}
