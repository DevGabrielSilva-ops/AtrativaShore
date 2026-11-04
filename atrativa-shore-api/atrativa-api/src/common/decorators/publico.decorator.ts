import { SetMetadata } from '@nestjs/common';

export const CHAVE_PUBLICO = 'rotaPublica';

export const Publico = () => SetMetadata(CHAVE_PUBLICO, true);
