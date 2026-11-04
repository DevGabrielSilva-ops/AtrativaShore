import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { UsuarioAutenticado } from '../../auth/usuario-autenticado.js';

/** Injeta o usuário autenticado (preenchido pela JwtStrategy). */
export const UsuarioAtual = createParamDecorator(
  (_dados: unknown, contexto: ExecutionContext): UsuarioAutenticado => {
    const requisicao = contexto.switchToHttp().getRequest<{ user: UsuarioAutenticado }>();
    return requisicao.user;
  },
);
