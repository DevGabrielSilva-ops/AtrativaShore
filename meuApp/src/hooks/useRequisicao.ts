import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { mensagemErro } from '../services/api';

interface EstadoRequisicao<T> {
  dados: T | null;
  carregando: boolean;
  erro: string | null;
  recarregar: () => void;
}

/**
 * Executa uma consulta à API e mantém dados/carregando/erro.
 * Refaz a consulta quando `dependencias` mudam; descarta respostas antigas
 * (se o filtro mudar no meio, só a última resposta é aplicada).
 */
export function useRequisicao<T>(
  buscar: () => Promise<T>,
  dependencias: unknown[],
  habilitado = true,
): EstadoRequisicao<T> {
  const [versao, setVersao] = useState(0);
  // Identifica a consulta atual; "carregando" é derivado de qual consulta já respondeu.
  const chave = `${versao}|${JSON.stringify(dependencias)}`;
  const [dados, setDados] = useState<T | null>(null);
  const [concluida, setConcluida] = useState<{ chave: string; erro: string | null } | null>(null);
  const buscarRef = useRef(buscar);
  useLayoutEffect(() => {
    buscarRef.current = buscar;
  });

  useEffect(() => {
    if (!habilitado) return;
    let atual = true;
    buscarRef
      .current()
      .then((resultado) => {
        if (!atual) return;
        setDados(resultado);
        setConcluida({ chave, erro: null });
      })
      .catch((falha: unknown) => {
        if (atual) setConcluida({ chave, erro: mensagemErro(falha) });
      });
    // Resposta de uma consulta substituída é descartada.
    return () => {
      atual = false;
    };
  }, [chave, habilitado]);

  const recarregar = useCallback(() => setVersao((v) => v + 1), []);
  const carregando = habilitado && concluida?.chave !== chave;
  const erro = !carregando && concluida ? concluida.erro : null;
  return { dados, carregando, erro, recarregar };
}

/** Valor que só muda depois de `atraso` ms sem alterações (busca enquanto digita). */
export function useAtrasado<T>(valor: T, atraso = 350): T {
  const [atrasado, setAtrasado] = useState(valor);
  useEffect(() => {
    const id = window.setTimeout(() => setAtrasado(valor), atraso);
    return () => window.clearTimeout(id);
  }, [valor, atraso]);
  return atrasado;
}

/** Envolve uma ação (salvar, excluir) impedindo envio duplicado. */
export function useAcao<A extends unknown[], R>(acao: (...args: A) => Promise<R>) {
  const [executando, setExecutando] = useState(false);
  const travado = useRef(false);
  const executar = useCallback(
    async (...args: A): Promise<R | undefined> => {
      if (travado.current) return undefined;
      travado.current = true;
      setExecutando(true);
      try {
        return await acao(...args);
      } finally {
        travado.current = false;
        setExecutando(false);
      }
    },
    [acao],
  );
  return { executar, executando };
}
