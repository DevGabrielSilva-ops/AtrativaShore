import { cnpjValido, cpfOuCnpjValido, cpfValido, somenteDigitos } from './documentos.js';

describe('documentos', () => {
  it('valida CPF com e sem máscara', () => {
    expect(cpfValido('529.982.247-25')).toBe(true);
    expect(cpfValido('52998224725')).toBe(true);
    expect(cpfValido('529.982.247-26')).toBe(false);
    expect(cpfValido('111.111.111-11')).toBe(false);
    expect(cpfValido('123')).toBe(false);
  });

  it('valida CNPJ', () => {
    expect(cnpjValido('11.222.333/0001-81')).toBe(true);
    expect(cnpjValido('11.222.333/0001-80')).toBe(false);
  });

  it('aceita CPF ou CNPJ no mesmo campo', () => {
    expect(cpfOuCnpjValido('52998224725')).toBe(true);
    expect(cpfOuCnpjValido('11222333000181')).toBe(true);
    expect(somenteDigitos('529.982.247-25')).toBe('52998224725');
  });
});
