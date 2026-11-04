export interface UsuarioAutenticado {
  id: number;
  login: string;
  idPerfil: number;
  perfil: string | null;
  administrador: boolean;
}

export interface PayloadJwt {
  sub: number;
  login: string;
  perfil: number;
}
