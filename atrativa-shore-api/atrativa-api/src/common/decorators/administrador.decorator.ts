import { SetMetadata } from '@nestjs/common';

export const CHAVE_SOMENTE_ADMINISTRADOR = 'somenteAdministrador';

export const SomenteAdministrador = () => SetMetadata(CHAVE_SOMENTE_ADMINISTRADOR, true);
