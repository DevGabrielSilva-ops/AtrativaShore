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
