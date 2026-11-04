import type { ValidationError } from '@nestjs/common';
import { achatarErros, traduzirMensagem } from './mensagens-validacao.js';

describe('mensagens de validação', () => {
  it('traduz as mensagens do class-validator', () => {
    expect(traduzirMensagem('nome should not be empty')).toBe('nome é obrigatório');
    expect(traduzirMensagem('nome must be shorter than or equal to 60 characters')).toBe(
      'nome deve ter no máximo 60 caracteres',
    );
    expect(traduzirMensagem('property total should not exist')).toBe('o campo total não é permitido');
  });

  it('mostra o caminho completo em erros de itens aninhados', () => {
    const erros = [
      {
        property: 'itens',
        children: [
          {
            property: '0',
            children: [
              { property: 'quantidade', constraints: { isPositive: 'quantidade must be a positive number' }, children: [] },
            ],
          },
        ],
      },
    ] as unknown as ValidationError[];
    expect(achatarErros(erros)).toEqual(['itens.0.quantidade deve ser maior que zero']);
  });
});
