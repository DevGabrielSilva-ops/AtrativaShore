import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { IoSearch } from 'react-icons/io5';
import { useAtrasado } from '../hooks/useRequisicao';
import { mensagemErro } from '../services/api';
import { Spinner } from './ui/Spinner';

interface Props<T> {
  rotulo: string;
  placeholder?: string;
  buscar: (termo: string) => Promise<T[]>;
  /** Enter com o texto digitado (ex.: código de barras lido pelo leitor). Retorna o item ou null. */
  buscarExato?: (termo: string) => Promise<T | null>;
  chave: (item: T) => string | number;
  renderizar: (item: T) => ReactNode;
  aoSelecionar: (item: T) => void;
  autoFocus?: boolean;
  minimo?: number;
  rotuloVisivel?: boolean;
}

/** Campo de busca com lista de sugestões (combobox acessível por teclado). */
export function SeletorBusca<T>({
  rotulo,
  placeholder,
  buscar,
  buscarExato,
  chave,
  renderizar,
  aoSelecionar,
  autoFocus,
  minimo = 2,
  rotuloVisivel = false,
}: Props<T>) {
  const id = useId();
  const [texto, setTexto] = useState('');
  const [resultado, setResultado] = useState<{ termo: string; itens: T[]; erro: string | null } | null>(null);
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(0);
  const [buscandoExato, setBuscandoExato] = useState(false);
  const atrasado = useAtrasado(texto, 250);
  const termo = atrasado.trim();
  const pesquisar = termo.length >= minimo;
  // Só vale o resultado do termo atual; enquanto ele não chega, está carregando.
  const atualizado = pesquisar && resultado?.termo === termo;
  const itens = atualizado ? resultado.itens : [];
  const erro = atualizado ? resultado.erro : null;
  const carregando = buscandoExato || (pesquisar && !atualizado);
  const caixa = useRef<HTMLDivElement>(null);
  const buscarRef = useRef(buscar);
  useEffect(() => {
    buscarRef.current = buscar;
  });

  useEffect(() => {
    if (!pesquisar) return;
    let atual = true;
    buscarRef
      .current(termo)
      .then((lista) => {
        if (!atual) return;
        setResultado({ termo, itens: lista, erro: null });
        setAtivo(0);
        setAberto(true);
      })
      .catch((falha: unknown) => {
        if (atual) setResultado({ termo, itens: [], erro: mensagemErro(falha) });
      });
    return () => {
      atual = false;
    };
  }, [termo, pesquisar]);

  useEffect(() => {
    const fora = (evento: MouseEvent) => {
      if (!caixa.current?.contains(evento.target as Node)) setAberto(false);
    };
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, []);

  const escolher = (item: T) => {
    aoSelecionar(item);
    setTexto('');
    setAberto(false);
  };

  const teclado = async (evento: KeyboardEvent<HTMLInputElement>) => {
    if (evento.key === 'ArrowDown') {
      evento.preventDefault();
      setAberto(true);
      setAtivo((i) => Math.min(i + 1, itens.length - 1));
    } else if (evento.key === 'ArrowUp') {
      evento.preventDefault();
      setAtivo((i) => Math.max(i - 1, 0));
    } else if (evento.key === 'Escape') {
      setAberto(false);
    } else if (evento.key === 'Enter') {
      evento.preventDefault();
      const digitado = texto.trim();
      if (!digitado) return;
      // Leitor de código de barras: tenta o código exato antes da lista.
      if (buscarExato && /^\d{4,}$/.test(digitado)) {
        setBuscandoExato(true);
        try {
          const exato = await buscarExato(digitado);
          if (exato) {
            escolher(exato);
            return;
          }
        } catch {
          // não achou pelo código: segue para a lista
        } finally {
          setBuscandoExato(false);
        }
      }
      if (aberto && itens[ativo]) escolher(itens[ativo]);
    }
  };

  const idLista = `${id}-lista`;
  return (
    <div className="seletor" ref={caixa}>
      <label htmlFor={id} className={rotuloVisivel ? 'seletor-rotulo' : 'sr-only'}>
        {rotulo}
      </label>
      <div className="seletor-entrada">
        <IoSearch aria-hidden size={18} />
        <input
          id={id}
          className="entrada"
          role="combobox"
          aria-expanded={aberto && itens.length > 0}
          aria-controls={idLista}
          aria-autocomplete="list"
          aria-activedescendant={aberto && itens[ativo] ? `${id}-op-${ativo}` : undefined}
          autoComplete="off"
          autoFocus={autoFocus}
          placeholder={placeholder ?? rotulo}
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            setAberto(true);
          }}
          onFocus={() => itens.length && setAberto(true)}
          onKeyDown={teclado}
        />
        {carregando ? <Spinner tamanho={16} /> : null}
      </div>
      {aberto && texto.trim().length >= minimo ? (
        <ul className="seletor-lista" id={idLista} role="listbox">
          {erro ? <li className="seletor-vazio">{erro}</li> : null}
          {!erro && !carregando && itens.length === 0 && atrasado.trim() === texto.trim() ? (
            <li className="seletor-vazio">Nada encontrado para “{texto.trim()}”.</li>
          ) : null}
          {itens.map((item, indice) => (
            <li
              key={chave(item)}
              id={`${id}-op-${indice}`}
              role="option"
              aria-selected={indice === ativo}
              className={indice === ativo ? 'seletor-opcao ativa' : 'seletor-opcao'}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setAtivo(indice)}
              onClick={() => escolher(item)}
            >
              {renderizar(item)}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
