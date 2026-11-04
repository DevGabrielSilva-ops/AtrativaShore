import type { UsuarioAutenticado } from '../types/api';
export function destinoInicial(usuario: UsuarioAutenticado): string {
  if (usuario.trocarSenha) return '/trocar-senha';
  if (usuario.papel === 'SUPER_ADMIN') return '/plataforma';
  if (usuario.permissoes.includes('dashboard.ver')) return '/';
  if (usuario.permissoes.includes('vendas.registrar')) return '/vendas/nova';
  if (usuario.permissoes.includes('estoque.consultar')) return '/estoque';
  return '/perfil';
}
