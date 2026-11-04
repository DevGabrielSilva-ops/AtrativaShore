import { semSegredos, senhaTemporaria, sha256 } from './segredos.js';

describe('segredos', () => {
  it('remove senhas, tokens e códigos dos detalhes de auditoria', () => {
    const limpo = semSegredos({
      nome: 'Maria',
      senha: '123456',
      responsavel: { email: 'm@m.com', senha: 'x' },
      codigo: 'ATV-AAAAA',
      itens: [{ refreshToken: 'abc', quantidade: 1 }],
    });
    expect(JSON.stringify(limpo)).not.toMatch(/123456|ATV-AAAAA|"x"|abc/);
    expect(limpo).toMatchObject({ nome: 'Maria', responsavel: { email: 'm@m.com' }, itens: [{ quantidade: 1 }] });
  });

  it('gera senhas temporárias diferentes e sem caracteres ambíguos', () => {
    const a = senhaTemporaria();
    expect(a).toHaveLength(12);
    expect(a).not.toMatch(/[0O1lI]/);
    expect(senhaTemporaria()).not.toBe(a);
  });

  it('sha256 é determinístico', () => {
    expect(sha256('a')).toBe(sha256('a'));
    expect(sha256('a')).toHaveLength(64);
  });
});
