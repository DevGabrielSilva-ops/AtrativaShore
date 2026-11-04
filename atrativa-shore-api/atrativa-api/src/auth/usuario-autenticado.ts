import type { Permissao } from '../acesso/permissoes.js';
import type { Papel, StatusEmpresa } from '../plataforma/entities/papeis.js';

export interface EmpresaDoUsuario {
  id: number;
  nome: string;
  status: StatusEmpresa;
  banco: string;
}

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
  empresa: EmpresaDoUsuario | null;
  idLogin: number | null;
  trocarSenha: boolean;
  administrador: boolean;
}

export interface PayloadJwt {
  sub: number;
  ver: number;
}

export function usuarioPublico(usuario: UsuarioAutenticado) {
  const { empresa, ...resto } = usuario;
  return {
    ...resto,
    empresa: empresa ? { id: empresa.id, nome: empresa.nome, status: empresa.status } : null,
  };
}

export function idLoginDe(usuario: UsuarioAutenticado): number {
  if (!usuario.idLogin) throw new Error('Usuário sem vínculo com o cadastro de vendedores da empresa');
  return usuario.idLogin;
}
