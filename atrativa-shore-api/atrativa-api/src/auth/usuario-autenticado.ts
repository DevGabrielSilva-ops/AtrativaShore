/** Dados do usuário autenticado, disponíveis em toda requisição protegida. */
export interface UsuarioAutenticado {
  id: number;
  login: string;
  idPerfil: number;
  perfil: string | null;
  administrador: boolean;
}

/** Conteúdo do JWT. */
export interface PayloadJwt {
  sub: number;
  login: string;
  perfil: number;
}
