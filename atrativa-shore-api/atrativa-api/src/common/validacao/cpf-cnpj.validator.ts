import { registerDecorator, type ValidationOptions } from 'class-validator';
import { cpfOuCnpjValido } from '../utils/documentos.js';

export function IsCpfOuCnpj(opcoes?: ValidationOptions): PropertyDecorator {
  return (alvo: object, propriedade: string | symbol) => {
    registerDecorator({
      name: 'isCpfOuCnpj',
      target: alvo.constructor,
      propertyName: propriedade.toString(),
      options: { message: '$property deve ser um CPF ou CNPJ válido', ...opcoes },
      validator: {
        validate: (valor: unknown) => typeof valor === 'string' && cpfOuCnpjValido(valor),
      },
    });
  };
}
