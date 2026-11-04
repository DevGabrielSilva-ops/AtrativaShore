import { SetMetadata } from '@nestjs/common';

export const CHAVE_PUBLICO = 'rotaPublica';

/** Libera a rota do guard JWT global (ex.: login). */
export const Publico = () => SetMetadata(CHAVE_PUBLICO, true);
