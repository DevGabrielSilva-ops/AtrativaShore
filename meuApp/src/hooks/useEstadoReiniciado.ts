import { useCallback, useState } from 'react';

export function useEstadoReiniciado<T>(inicial: T, dependencias: unknown[]) {
  const chave = JSON.stringify(dependencias);
  const [padrao] = useState(inicial);
  const [estado, setEstado] = useState({ chave, valor: inicial });
  const valor = estado.chave === chave ? estado.valor : padrao;

  const definir = useCallback(
    (novo: T | ((atual: T) => T)) =>
      setEstado((anterior) => {
        const atual = anterior.chave === chave ? anterior.valor : padrao;
        return { chave, valor: typeof novo === 'function' ? (novo as (atual: T) => T)(atual) : novo };
      }),
    [chave, padrao],
  );
  return [valor, definir] as const;
}

export function usePagina(filtros: unknown[]) {
  return useEstadoReiniciado(1, filtros);
}
