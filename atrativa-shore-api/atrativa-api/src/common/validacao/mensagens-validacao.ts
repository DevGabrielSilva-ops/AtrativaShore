import { BadRequestException, type ValidationError } from '@nestjs/common';

const TRADUCOES: Array<[RegExp, string]> = [
  [/^property (\S+) should not exist$/, 'o campo $1 não é permitido'],
  [/^(\S+) should not be empty$/, '$1 é obrigatório'],
  [/^(\S+) should not be null or undefined$/, '$1 é obrigatório'],
  [/^(\S+) must be shorter than or equal to (\d+) characters$/, '$1 deve ter no máximo $2 caracteres'],
  [/^(\S+) must be longer than or equal to (\d+) characters$/, '$1 deve ter no mínimo $2 caracteres'],
  [/^(\S+) must be a string$/, '$1 deve ser um texto'],
  [/^(\S+) must be an integer number$/, '$1 deve ser um número inteiro'],
  [/^(\S+) must be a number conforming to the specified constraints$/, '$1 deve ser um número'],
  [/^(\S+) must be a positive number$/, '$1 deve ser maior que zero'],
  [/^(\S+) must not be less than (\S+)$/, '$1 deve ser maior ou igual a $2'],
  [/^(\S+) must not be greater than (\S+)$/, '$1 deve ser menor ou igual a $2'],
  [/^(\S+) must be one of the following values: (.*)$/, '$1 deve ser um destes valores: $2'],
  [/^(\S+) must be an array$/, '$1 deve ser uma lista'],
  [/^(\S+) must contain at least (\d+) elements$/, '$1 deve ter pelo menos $2 item(ns)'],
  [/^(\S+) must contain no more than (\d+) elements$/, '$1 deve ter no máximo $2 itens'],
  [/^(\S+) must be an email$/, '$1 deve ser um e-mail válido'],
  [/^(\S+) must be a boolean value$/, '$1 deve ser verdadeiro ou falso'],
  [/^(\S+) must be a valid ISO 8601 date string$/, '$1 deve ser uma data válida (AAAA-MM-DD)'],
  [/^(\S+) must match (.*) regular expression$/, '$1 está em formato inválido'],
  [/^nested property (\S+) must be either object or array$/, '$1 deve ser um objeto ou lista'],
  [/^each value in (\S+) must be (.*)$/, 'cada valor de $1 deve ser $2'],
];

export function traduzirMensagem(mensagem: string): string {
  for (const [padrao, traducao] of TRADUCOES) {
    if (padrao.test(mensagem)) return mensagem.replace(padrao, traducao);
  }
  return mensagem;
}

export function achatarErros(erros: ValidationError[], prefixo = ''): string[] {
  return erros.flatMap((erro) => {
    const caminho = prefixo ? `${prefixo}.${erro.property}` : erro.property;
    const proprias = Object.values(erro.constraints ?? {}).map((mensagem) => {
      const traduzida = traduzirMensagem(mensagem);
      return prefixo && traduzida.startsWith(erro.property)
        ? caminho + traduzida.slice(erro.property.length)
        : traduzida;
    });
    return [...proprias, ...achatarErros(erro.children ?? [], caminho)];
  });
}

export function fabricaExcecaoValidacao(erros: ValidationError[]): BadRequestException {
  return new BadRequestException(achatarErros(erros));
}
