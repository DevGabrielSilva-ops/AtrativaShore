import { type CallHandler, type ExecutionContext, Injectable, type NestInterceptor } from '@nestjs/common';
import { map, type Observable } from 'rxjs';

function ehPaginado(valor: unknown): boolean {
  return (
    typeof valor === 'object' &&
    valor !== null &&
    'data' in valor &&
    'meta' in valor &&
    Array.isArray((valor as { data: unknown }).data)
  );
}

/**
 * Padroniza as respostas de sucesso:
 *  - listas paginadas: { data: [...], meta: { page, limit, total, totalPages } }
 *  - demais respostas: { data: <objeto> }
 * Respostas sem corpo (204) passam direto.
 */
@Injectable()
export class RespostaInterceptor implements NestInterceptor {
  intercept(_contexto: ExecutionContext, proximo: CallHandler): Observable<unknown> {
    return proximo.handle().pipe(
      map((valor: unknown) => {
        if (valor === undefined) return valor;
        if (ehPaginado(valor)) return valor;
        return { data: valor };
      }),
    );
  }
}
