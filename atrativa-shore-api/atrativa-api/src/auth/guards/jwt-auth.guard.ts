import { type ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { CHAVE_PUBLICO } from '../../common/decorators/publico.decorator.js';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  override canActivate(contexto: ExecutionContext) {
    const publico = this.reflector.getAllAndOverride<boolean>(CHAVE_PUBLICO, [
      contexto.getHandler(),
      contexto.getClass(),
    ]);
    if (publico) return true;
    return super.canActivate(contexto);
  }

  override handleRequest<T>(erro: unknown, usuario: T): T {
    if (erro || !usuario) {
      throw erro instanceof UnauthorizedException
        ? erro
        : new UnauthorizedException('Token ausente, inválido ou expirado');
    }
    return usuario;
  }
}
