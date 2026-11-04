import { gerarCodigoAtivacao, hashDoCodigo, normalizarCodigo, prefixoDoCodigo, sha256Normalizado, situacaoDoCodigo } from './codigos.js';

describe('códigos de ativação', () => {
  it('gera códigos únicos no formato ATV-XXXXX-XXXXX-XXXXX-XXXXX-XXXXX', () => {
    const gerados = new Set<string>();
    for (let i = 0; i < 500; i += 1) {
      const { codigo } = gerarCodigoAtivacao();
      expect(codigo).toMatch(/^ATV(-[0-9A-HJKMNP-TV-Z]{5}){5}$/);
      gerados.add(codigo);
    }
    expect(gerados.size).toBe(500);
  });

  it('o hash gravado confere com o código digitado de várias formas', () => {
    const { codigo, normalizado } = gerarCodigoAtivacao();
    const gravado = sha256Normalizado(normalizado);
    expect(hashDoCodigo(codigo)).toBe(gravado);
    expect(hashDoCodigo(codigo.toLowerCase())).toBe(gravado);
    expect(hashDoCodigo(codigo.replace(/-/g, ' '))).toBe(gravado);
    expect(hashDoCodigo(normalizado)).toBe(gravado);
    expect(gravado).not.toContain(normalizado);
  });

  it('troca letras ambíguas digitadas por engano', () => {
    expect(normalizarCodigo('atv-oil')).toBe('011');
  });

  it('o prefixo exibido não revela o código inteiro', () => {
    const { normalizado } = gerarCodigoAtivacao();
    expect(prefixoDoCodigo(normalizado)).toBe(`ATV-${normalizado.slice(0, 5)}`);
  });

  it('calcula a situação: revogado, usado, expirado ou ativo', () => {
    const futuro = new Date(Date.now() + 60_000);
    const passado = new Date(Date.now() - 60_000);
    expect(situacaoDoCodigo({ revogadoEm: new Date(), expiraEm: futuro, usos: 0, maxUsos: 1 })).toBe('REVOGADO');
    expect(situacaoDoCodigo({ revogadoEm: null, expiraEm: futuro, usos: 1, maxUsos: 1 })).toBe('USADO');
    expect(situacaoDoCodigo({ revogadoEm: null, expiraEm: passado, usos: 0, maxUsos: 1 })).toBe('EXPIRADO');
    expect(situacaoDoCodigo({ revogadoEm: null, expiraEm: futuro, usos: 1, maxUsos: 3 })).toBe('ATIVO');
  });
});
