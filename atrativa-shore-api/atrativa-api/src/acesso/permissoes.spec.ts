import { calcularPermissoes, PERMISSOES_POR_PAPEL, statusEfetivo, TODAS_PERMISSOES } from './permissoes.js';

describe('permissões por papel', () => {
  it('administrador da empresa tem todas as permissões, mesmo com cargo', () => {
    expect(calcularPermissoes('COMPANY_ADMIN', ['vendas.registrar'])).toEqual(TODAS_PERMISSOES);
  });

  it('gerente não gerencia funcionários nem dados da empresa', () => {
    const gerente = calcularPermissoes('MANAGER');
    expect(gerente).toContain('relatorios.vendas');
    expect(gerente).toContain('funcionarios.consultar');
    expect(gerente).not.toContain('funcionarios.gerenciar');
    expect(gerente).not.toContain('empresa.configurar');
  });

  it('vendedor vende e consulta, mas não estorna nem vê vendas dos outros', () => {
    const vendedor = calcularPermissoes('SELLER');
    expect(vendedor).toEqual(expect.arrayContaining(['vendas.registrar', 'clientes.consultar', 'estoque.consultar']));
    expect(vendedor).not.toContain('vendas.estornar');
    expect(vendedor).not.toContain('vendas.consultar_todas');
  });

  it('cargo personalizado substitui as permissões do papel e ignora nomes inválidos', () => {
    expect(calcularPermissoes('SELLER', ['vendas.registrar', 'clientes.gerenciar', 'inventada'])).toEqual([
      'vendas.registrar',
      'clientes.gerenciar',
    ]);
  });

  it('superadministrador não tem permissões comerciais', () => {
    expect(calcularPermissoes('SUPER_ADMIN')).toEqual([]);
  });

  it('todo papel de empresa usa apenas permissões do catálogo', () => {
    for (const lista of Object.values(PERMISSOES_POR_PAPEL)) {
      for (const permissao of lista) expect(TODAS_PERMISSOES).toContain(permissao);
    }
  });

  it('assinatura vencida torna a empresa EXPIRED', () => {
    expect(statusEfetivo('ACTIVE', '2026-01-31', '2026-02-01')).toBe('EXPIRED');
    expect(statusEfetivo('ACTIVE', '2026-02-01', '2026-02-01')).toBe('ACTIVE');
    expect(statusEfetivo('ACTIVE', null, '2026-02-01')).toBe('ACTIVE');
    expect(statusEfetivo('SUSPENDED', '2020-01-01', '2026-02-01')).toBe('SUSPENDED');
  });
});
