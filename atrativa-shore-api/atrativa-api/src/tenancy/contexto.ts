import { AsyncLocalStorage } from 'node:async_hooks';
import { InternalServerErrorException } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import type { UsuarioAutenticado } from '../auth/usuario-autenticado.js';

export interface ContextoRequisicao {
  usuario?: UsuarioAutenticado;
  ip: string | null;
  userAgent: string | null;
  fonteEmpresa?: DataSource;
}

export const contextoRequisicao = new AsyncLocalStorage<ContextoRequisicao>();

export function contextoAtual(): ContextoRequisicao | undefined {
  return contextoRequisicao.getStore();
}

export function fonteDaEmpresa(): DataSource {
  const fonte = contextoRequisicao.getStore()?.fonteEmpresa;
  if (!fonte) {
    throw new InternalServerErrorException('Operação comercial sem empresa no contexto da requisição');
  }
  return fonte;
}

export function executarComEmpresa<T>(fonte: DataSource, acao: () => Promise<T>): Promise<T> {
  const atual = contextoRequisicao.getStore();
  return contextoRequisicao.run({ ip: null, userAgent: null, ...atual, fonteEmpresa: fonte }, acao);
}

const PROPRIEDADES_INSPECIONADAS = new Set<string | symbol>([
  'then',
  'constructor',
  'onModuleInit',
  'onApplicationBootstrap',
  'onModuleDestroy',
  'beforeApplicationShutdown',
  'onApplicationShutdown',
]);

export function proxyDoContexto<T extends object>(resolver: () => T): T {
  return new Proxy({} as T, {
    get(_alvo, propriedade) {
      if (typeof propriedade === 'symbol' || PROPRIEDADES_INSPECIONADAS.has(propriedade)) {
        if (!contextoRequisicao.getStore()?.fonteEmpresa) return undefined;
      }
      const real = resolver();
      const valor = Reflect.get(real, propriedade, real) as unknown;
      return typeof valor === 'function' ? (valor as (...args: unknown[]) => unknown).bind(real) : valor;
    },
    has(_alvo, propriedade) {
      return propriedade in resolver();
    },
  });
}
