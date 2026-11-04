import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Spinner } from './Spinner';

type Variante = 'primario' | 'secundario' | 'fantasma' | 'perigo';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  tamanho?: 'sm' | 'md';
  carregando?: boolean;
  icone?: ReactNode;
  somenteIcone?: boolean;
}

export function Button({
  variante = 'primario',
  tamanho = 'md',
  carregando = false,
  icone,
  somenteIcone = false,
  children,
  className = '',
  disabled,
  type = 'button',
  ...resto
}: Props) {
  const classes = ['btn', `btn-${variante}`, `btn-${tamanho}`, somenteIcone ? 'btn-icone' : '', className]
    .filter(Boolean)
    .join(' ');
  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || carregando}
      aria-busy={carregando || undefined}
      aria-label={somenteIcone && typeof children === 'string' ? children : resto['aria-label']}
      title={somenteIcone && typeof children === 'string' ? children : resto.title}
      {...resto}
    >
      {carregando ? <Spinner tamanho={16} /> : icone}
      {somenteIcone ? null : <span>{children}</span>}
    </button>
  );
}
