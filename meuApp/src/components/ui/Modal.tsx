import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IoClose } from 'react-icons/io5';

interface Props {
  aberto: boolean;
  titulo: string;
  descricao?: string;
  aoFechar: () => void;
  children: ReactNode;
  rodape?: ReactNode;
  tamanho?: 'sm' | 'md' | 'lg';
}

const pilha: string[] = [];

export function Modal({ aberto, titulo, descricao, aoFechar, children, rodape, tamanho = 'md' }: Props) {
  const idTitulo = useId();
  const caixa = useRef<HTMLDivElement>(null);
  const aoFecharRef = useRef(aoFechar);
  useEffect(() => {
    aoFecharRef.current = aoFechar;
  });

  useEffect(() => {
    if (!aberto) return;
    pilha.push(idTitulo);
    const anterior = document.activeElement as HTMLElement | null;
    const corpo = document.body;
    const overflowAnterior = corpo.style.overflow;
    corpo.style.overflow = 'hidden';
    corpo.classList.add('com-modal');

    const focaveis = () =>
      Array.from(
        caixa.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
    window.setTimeout(() => {
      const alvo = caixa.current?.querySelector<HTMLElement>('[autofocus]') ?? focaveis()[1] ?? focaveis()[0];
      alvo?.focus();
    }, 0);

    const teclado = (evento: KeyboardEvent) => {
      if (pilha[pilha.length - 1] !== idTitulo) return;
      if (evento.key === 'Escape') {
        evento.stopPropagation();
        aoFecharRef.current();
      }
      if (evento.key === 'Tab') {
        const lista = focaveis();
        if (lista.length === 0) return;
        const primeiro = lista[0];
        const ultimo = lista[lista.length - 1];
        if (evento.shiftKey && document.activeElement === primeiro) {
          evento.preventDefault();
          ultimo.focus();
        } else if (!evento.shiftKey && document.activeElement === ultimo) {
          evento.preventDefault();
          primeiro.focus();
        }
      }
    };
    document.addEventListener('keydown', teclado);
    return () => {
      document.removeEventListener('keydown', teclado);
      pilha.splice(pilha.lastIndexOf(idTitulo), 1);
      if (pilha.length === 0) {
        corpo.style.overflow = overflowAnterior;
        corpo.classList.remove('com-modal');
      }
      anterior?.focus?.();
    };
  }, [aberto, idTitulo]);

  if (!aberto) return null;

  return createPortal(
    <div className="modal-fundo" onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
      <div
        ref={caixa}
        className={`modal modal-${tamanho}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
      >
        <header className="modal-cabecalho">
          <div>
            <h2 id={idTitulo}>{titulo}</h2>
            {descricao ? <p className="muted pequeno">{descricao}</p> : null}
          </div>
          <button type="button" className="btn btn-fantasma btn-icone btn-sm" onClick={aoFechar} aria-label="Fechar">
            <IoClose size={20} />
          </button>
        </header>
        <div className="modal-corpo">{children}</div>
        {rodape ? <footer className="modal-rodape">{rodape}</footer> : null}
      </div>
    </div>,
    document.body,
  );
}
