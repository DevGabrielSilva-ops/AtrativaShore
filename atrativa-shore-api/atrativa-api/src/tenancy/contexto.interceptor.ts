import { type CallHandler, type ExecutionContext, Injectable, type NestInterceptor } from '@nestjs/common';
import { defer, Observable, switchMap } from 'rxjs';
import type { UsuarioAutenticado } from '../auth/usuario-autenticado.js';
import { ConexoesEmpresaService } from './conexoes-empresa.service.js';
import { type ContextoRequisicao, contextoRequisicao } from './contexto.js';

interface RequisicaoHttp {
  user?: UsuarioAutenticado;
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
}

export function ipDaRequisicao(requisicao: RequisicaoHttp): string | null {
  return (requisicao.ip ?? requisicao.socket?.remoteAddress ?? null)?.slice(0, 45) ?? null;
}

@Injectable()
export class ContextoInterceptor implements NestInterceptor {
  constructor(private readonly conexoes: ConexoesEmpresaService) {}

  intercept(contexto: ExecutionContext, proximo: CallHandler): Observable<unknown> {
    const requisicao = contexto.switchToHttp().getRequest<RequisicaoHttp>();
    const agente = requisicao.headers['user-agent'];
    const store: ContextoRequisicao = {
      usuario: requisicao.user,
      ip: ipDaRequisicao(requisicao),
      userAgent: (Array.isArray(agente) ? agente[0] : agente)?.slice(0, 255) ?? null,
    };
    const empresa = requisicao.user?.empresa;
    return defer(async () => {
      if (empresa && empresa.status === 'ACTIVE') store.fonteEmpresa = await this.conexoes.obter(empresa.banco);
    }).pipe(
      switchMap(
        () =>
          new Observable<unknown>((assinante) => {
            const assinatura = contextoRequisicao.run(store, () => proximo.handle().subscribe(assinante));
            return () => assinatura.unsubscribe();
          }),
      ),
    );
  }
}
