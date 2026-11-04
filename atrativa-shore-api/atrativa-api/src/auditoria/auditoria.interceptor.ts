import { type CallHandler, type ExecutionContext, Injectable, type NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { type Observable, tap } from 'rxjs';
import { CHAVE_AUDITAR, type ConfiguracaoAuditoria } from './auditar.decorator.js';
import { AuditoriaService } from './auditoria.service.js';

function identificador(resultado: unknown, parametros: Record<string, string>): string | number | null {
  if (resultado && typeof resultado === 'object') {
    const objeto = resultado as Record<string, unknown>;
    for (const chave of ['id', 'controle', 'controleRecebimento', 'idProduto']) {
      const valor = objeto[chave];
      if (typeof valor === 'string' || typeof valor === 'number') return valor;
    }
  }
  return parametros.id ?? parametros.idProduto ?? parametros.codigo ?? null;
}

@Injectable()
export class AuditoriaInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditoria: AuditoriaService,
  ) {}

  intercept(contexto: ExecutionContext, proximo: CallHandler): Observable<unknown> {
    const configuracao = this.reflector.get<ConfiguracaoAuditoria | undefined>(CHAVE_AUDITAR, contexto.getHandler());
    if (!configuracao) return proximo.handle();
    const requisicao = contexto.switchToHttp().getRequest<{ body?: unknown; params?: Record<string, string> }>();
    return proximo.handle().pipe(
      tap((resultado) => {
        void this.auditoria.registrar({
          acao: configuracao.acao,
          entidade: configuracao.entidade,
          idEntidade: identificador(resultado, requisicao.params ?? {}),
          detalhes: requisicao.body && Object.keys(requisicao.body).length ? { dados: requisicao.body } : undefined,
        });
      }),
    );
  }
}
