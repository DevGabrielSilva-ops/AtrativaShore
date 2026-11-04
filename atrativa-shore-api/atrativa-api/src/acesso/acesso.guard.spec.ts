import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UsuarioAutenticado } from '../auth/usuario-autenticado.js';
import { CHAVE_PUBLICO } from '../common/decorators/publico.decorator.js';
import { CHAVE_ESCOPO, CHAVE_PERMISSOES } from './acesso.decorators.js';
import { AcessoGuard } from './acesso.guard.js';
import { calcularPermissoes } from './permissoes.js';

function usuario(parcial: Partial<UsuarioAutenticado>): UsuarioAutenticado {
  return {
    id: 1,
    nome: 'Teste',
    email: 't@t.com',
    login: null,
    papel: 'SELLER',
    idCargo: null,
    cargo: null,
    permissoes: calcularPermissoes('SELLER'),
    idEmpresa: 1,
    empresa: { id: 1, nome: 'Loja A', status: 'ACTIVE', banco: 'atrativa_emp_1' },
    idLogin: 5,
    trocarSenha: false,
    administrador: false,
    ...parcial,
  };
}

function contexto(user: UsuarioAutenticado | undefined, metadados: Record<string, unknown>): ExecutionContext {
  const handler = () => undefined;
  for (const [chave, valor] of Object.entries(metadados)) Reflect.defineMetadata(chave, valor, handler);
  return {
    getHandler: () => handler,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

const guard = new AcessoGuard(new Reflector());

describe('AcessoGuard', () => {
  it('libera rotas públicas sem usuário', () => {
    expect(guard.canActivate(contexto(undefined, { [CHAVE_PUBLICO]: true }))).toBe(true);
  });

  it('bloqueia a área da plataforma para administradores de empresa', () => {
    const admin = usuario({ papel: 'COMPANY_ADMIN', permissoes: calcularPermissoes('COMPANY_ADMIN') });
    expect(() => guard.canActivate(contexto(admin, { [CHAVE_ESCOPO]: 'PLATAFORMA' }))).toThrow(ForbiddenException);
  });

  it('libera a área da plataforma só para SUPER_ADMIN', () => {
    const dono = usuario({ papel: 'SUPER_ADMIN', idEmpresa: null, empresa: null, permissoes: [] });
    expect(guard.canActivate(contexto(dono, { [CHAVE_ESCOPO]: 'PLATAFORMA' }))).toBe(true);
  });

  it('bloqueia rotas comerciais para o superadministrador', () => {
    const dono = usuario({ papel: 'SUPER_ADMIN', idEmpresa: null, empresa: null, permissoes: [] });
    expect(() => guard.canActivate(contexto(dono, {}))).toThrow('exclusiva das empresas');
  });

  it('bloqueia empresa suspensa ou expirada mesmo com permissão', () => {
    for (const status of ['SUSPENDED', 'EXPIRED', 'PENDING'] as const) {
      const vendedor = usuario({ empresa: { id: 1, nome: 'Loja A', status, banco: 'x' } });
      expect(() => guard.canActivate(contexto(vendedor, { [CHAVE_PERMISSOES]: ['vendas.registrar'] }))).toThrow(
        ForbiddenException,
      );
    }
  });

  it('exige a permissão declarada na rota', () => {
    const vendedor = usuario({});
    expect(guard.canActivate(contexto(vendedor, { [CHAVE_PERMISSOES]: ['vendas.registrar'] }))).toBe(true);
    expect(() => guard.canActivate(contexto(vendedor, { [CHAVE_PERMISSOES]: ['vendas.estornar'] }))).toThrow(
      'vendas.estornar',
    );
    expect(() => guard.canActivate(contexto(vendedor, { [CHAVE_PERMISSOES]: ['funcionarios.gerenciar'] }))).toThrow(
      ForbiddenException,
    );
  });

  it('com senha temporária só permite as rotas de conta', () => {
    const novo = usuario({ trocarSenha: true });
    expect(() => guard.canActivate(contexto(novo, { [CHAVE_PERMISSOES]: ['vendas.registrar'] }))).toThrow('senha temporária');
    expect(guard.canActivate(contexto(novo, { [CHAVE_ESCOPO]: 'QUALQUER' }))).toBe(true);
  });
});
