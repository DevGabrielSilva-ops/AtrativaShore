import {
  codigoBarrasCliente,
  codigoBarrasProduto,
  codigoCarne,
  digitoEan13,
  documentoVenda,
  eanValido,
  notaTroca,
} from './codigos.js';

describe('códigos no padrão do sistema desktop', () => {
  it('calcula o dígito EAN-13', () => {
    expect(digitoEan13('100000000001')).toBe('6');
    expect(eanValido('2000000575957')).toBe(true);
    expect(eanValido('2000000575958')).toBe(false);
  });

  it('gera o código do cliente igual ao cad_clientes.cod_barra', () => {
    expect(codigoBarrasCliente(1)).toBe('1000000000016');
    expect(codigoBarrasCliente(2)).toBe('1000000000023');
    expect(codigoBarrasCliente(325)).toBe('1000000003253');
    expect(codigoBarrasCliente(326)).toBe('1000000003260');
  });

  it('gera o código do carnê igual ao mv_financeiro.cod_carne', () => {
    expect(codigoCarne('20260820160232', 1)).toBe('2008616020014');
    expect(codigoCarne('20260820160232', 4)).toBe('2008616020045');
    expect(codigoCarne('20260821120241', 3)).toBe('2108612020039');
    expect(codigoCarne('20231014154003', 4)).toBe('1410315400041');
    expect(codigoCarne('20260807104927', 1)).toBe('0708610490012');
  });

  it('gera os documentos de venda e de troca do legado', () => {
    expect(documentoVenda('20260820160232')).toBe('V20260820160232');
    expect(notaTroca('20260807104927')).toBe('V60807104927');
  });

  it('gera código interno de produto com prefixo 2 e dígito válido', () => {
    const codigo = codigoBarrasProduto(600);
    expect(codigo).toMatch(/^2\d{12}$/);
    expect(eanValido(codigo)).toBe(true);
  });

  it('recusa entradas inválidas', () => {
    expect(() => codigoCarne('2026', 1)).toThrow(RangeError);
    expect(() => codigoBarrasCliente(0)).toThrow(RangeError);
  });
});
