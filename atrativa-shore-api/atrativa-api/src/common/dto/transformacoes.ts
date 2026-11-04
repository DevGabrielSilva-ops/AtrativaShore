import { Transform } from 'class-transformer';

export function ParaBooleano(): PropertyDecorator {
  return Transform(({ value }: { value: unknown }) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value === 'boolean') return value;
    const texto = String(value).toLowerCase();
    if (['true', '1', 'sim'].includes(texto)) return true;
    if (['false', '0', 'nao', 'não'].includes(texto)) return false;
    return value;
  });
}

export function Aparar(): PropertyDecorator {
  return Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const aparado = value.trim();
    return aparado === '' ? undefined : aparado;
  });
}

export function MaiusculasAparadas(): PropertyDecorator {
  return Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const aparado = value.trim().toUpperCase();
    return aparado === '' ? undefined : aparado;
  });
}
