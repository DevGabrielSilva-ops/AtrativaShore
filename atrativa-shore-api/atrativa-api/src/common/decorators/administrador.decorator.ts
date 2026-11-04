import { SetMetadata } from '@nestjs/common';

export const CHAVE_SOMENTE_ADMINISTRADOR = 'somenteAdministrador';

/** Restringe a rota a usuários do perfil ADMINISTRADOR (cad_login_perfil). */
export const SomenteAdministrador = () => SetMetadata(CHAVE_SOMENTE_ADMINISTRADOR, true);
