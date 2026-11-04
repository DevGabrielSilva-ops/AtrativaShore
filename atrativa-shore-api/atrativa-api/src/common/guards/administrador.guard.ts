import { type CanActivate, type ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UsuarioAutenticado } from '../../auth/usuario-autenticado.js';
import { CHAVE_SOMENTE_ADMINISTRADOR } from '../decorators/administrador.decorator.js';

@Injectable()
export class AdministradorGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(contexto: ExecutionContext): boolean {
    const exige = this.reflector.getAllAndOverride<boolean>(CHAVE_SOMENTE_ADMINISTRADOR, [
      contexto.getHandler(),
      contexto.getClass(),
    ]);
    if (!exige) return true;

    const usuario = contexto.switchToHttp().getRequest<{ user?: UsuarioAutenticado }>().user;
    if (!usuario?.administrador) {
      throw new ForbiddenException('Operação permitida apenas para o perfil ADMINISTRADOR');
    }
    return true;
  }
}
