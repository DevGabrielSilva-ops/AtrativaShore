import { useCallback, useState } from 'react';

export function useFormulario<T extends Record<string, string | boolean>>(inicial: T) {
  const [valores, setValores] = useState<T>(inicial);
  const [erros, setErros] = useState<Partial<Record<keyof T, string>>>({});

  const campo = useCallback(
    <K extends keyof T>(nome: K) => ({
      value: valores[nome] as string,
      onChange: (evento: { target: { value: string } }) => {
        const valor = evento.target.value;
        setValores((atual) => ({ ...atual, [nome]: valor }));
        setErros((atual) => (atual[nome] ? { ...atual, [nome]: undefined } : atual));
      },
      erro: erros[nome],
    }),
    [valores, erros],
  );

  const definir = useCallback(<K extends keyof T>(nome: K, valor: T[K]) => {
    setValores((atual) => ({ ...atual, [nome]: valor }));
  }, []);

  const reiniciar = useCallback((novos: T) => {
    setValores(novos);
    setErros({});
  }, []);

  return { valores, erros, setErros, campo, definir, reiniciar };
}

export function textoOuIndefinido(valor: string): string | undefined {
  const aparado = valor.trim();
  return aparado === '' ? undefined : aparado;
}

export function textoOuNulo(valor: string): string | null {
  const aparado = valor.trim();
  return aparado === '' ? null : aparado;
}
