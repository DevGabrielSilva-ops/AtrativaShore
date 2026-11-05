import { type CanActivate, type ExecutionContext, ForbiddenException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UsuarioAutenticado } from '../auth/usuario-autenticado.js';
import { restauracoes } from '../backup/bloqueio.js';
import { CHAVE_PUBLICO } from '../common/decorators/publico.decorator.js';
import { CHAVE_ESCOPO, CHAVE_PERMISSOES, type EscopoRota } from './acesso.decorators.js';
import { MENSAGEM_STATUS_EMPRESA, type Permissao } from './permissoes.js';

@Injectable()
export class AcessoGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(contexto: ExecutionContext): boolean {
    const alvos = [contexto.getHandler(), contexto.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(CHAVE_PUBLICO, alvos)) return true;

    const requisicao = contexto.switchToHttp().getRequest<{ user?: UsuarioAutenticado; method?: string; url?: string }>();
    const usuario = requisicao.user;
    if (!usuario) throw new ForbiddenException('Acesso negado');

    const escopo = this.reflector.getAllAndOverride<EscopoRota>(CHAVE_ESCOPO, alvos) ?? 'EMPRESA';
    if (escopo === 'QUALQUER') return true;

    if (usuario.trocarSenha) {
      throw new ForbiddenException('Troque a senha temporária antes de continuar.');
    }

    if (escopo === 'PLATAFORMA') {
      if (usuario.papel !== 'SUPER_ADMIN') throw new ForbiddenException('Área exclusiva da administração da plataforma');
      return true;
    }

    if (!usuario.empresa) throw new ForbiddenException('Esta área é exclusiva das empresas');
    if (usuario.empresa.status !== 'ACTIVE') throw new ForbiddenException(MENSAGEM_STATUS_EMPRESA[usuario.empresa.status]);
    if (requisicao.method && requisicao.method !== 'GET' && restauracoes.emAndamento(usuario.empresa.id)) {
      throw new ServiceUnavailableException('A empresa está restaurando um backup. Aguarde a conclusão para fazer alterações.');
    }

    const exigidas = this.reflector.getAllAndOverride<Permissao[]>(CHAVE_PERMISSOES, alvos) ?? [];
    const faltando = exigidas.filter((permissao) => !usuario.permissoes.includes(permissao));
    if (faltando.length > 0) {
      throw new ForbiddenException(`Seu cargo não tem permissão para esta operação (${faltando.join(', ')})`);
    }
    return true;
  }
}

export function temPermissao(usuario: UsuarioAutenticado, permissao: Permissao): boolean {
  return usuario.permissoes.includes(permissao);
}
