import { SetMetadata } from '@nestjs/common';
import type { Permissao } from './permissoes.js';

export const CHAVE_PERMISSOES = 'acesso:permissoes';
export const CHAVE_ESCOPO = 'acesso:escopo';

export type EscopoRota = 'EMPRESA' | 'PLATAFORMA' | 'QUALQUER';

export const RequerPermissao = (...permissoes: Permissao[]) => SetMetadata(CHAVE_PERMISSOES, permissoes);

export const SomentePlataforma = () => SetMetadata(CHAVE_ESCOPO, 'PLATAFORMA' satisfies EscopoRota);

export const QualquerUsuario = () => SetMetadata(CHAVE_ESCOPO, 'QUALQUER' satisfies EscopoRota);
