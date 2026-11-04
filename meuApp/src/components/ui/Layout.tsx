import type { ReactNode } from 'react';
import { IoSearch } from 'react-icons/io5';
import { Skeleton } from './Spinner';

export function PageHeader({ titulo, descricao, acoes }: { titulo: string; descricao?: string; acoes?: ReactNode }) {
  return (
    <div className="page-header">
      <div>
        <h1>{titulo}</h1>
        {descricao ? <p className="muted">{descricao}</p> : null}
      </div>
      {acoes ? <div className="linha page-header-acoes nao-imprimir">{acoes}</div> : null}
    </div>
  );
}

export function Painel({
  titulo,
  descricao,
  acoes,
  children,
  semEspaco = false,
  className = '',
}: {
  titulo?: string;
  descricao?: string;
  acoes?: ReactNode;
  children: ReactNode;
  semEspaco?: boolean;
  className?: string;
}) {
  return (
    <section className={`painel ${className}`}>
      {titulo || acoes ? (
        <header className="painel-cabecalho">
          <div>
            {titulo ? <h2>{titulo}</h2> : null}
            {descricao ? <p className="muted pequeno">{descricao}</p> : null}
          </div>
          {acoes ? <div className="linha nao-imprimir">{acoes}</div> : null}
        </header>
      ) : null}
      <div className={semEspaco ? 'painel-corpo-sem-espaco' : 'painel-corpo'}>{children}</div>
    </section>
  );
}

export function Indicador({
  rotulo,
  valor,
  nota,
  tom,
  carregando,
}: {
  rotulo: string;
  valor: ReactNode;
  nota?: ReactNode;
  tom?: 'positivo' | 'negativo' | 'alerta';
  carregando?: boolean;
}) {
  return (
    <div className="indicador">
      <p className="indicador-rotulo">{rotulo}</p>
      {carregando ? (
        <Skeleton largura="60%" altura={28} />
      ) : (
        <p className="indicador-valor">{valor}</p>
      )}
      {nota && !carregando ? <p className={`indicador-nota ${tom ? `nota-${tom}` : ''}`}>{nota}</p> : null}
    </div>
  );
}

export function CampoBusca({
  valor,
  aoMudar,
  rotulo,
  placeholder,
}: {
  valor: string;
  aoMudar: (valor: string) => void;
  rotulo: string;
  placeholder?: string;
}) {
  return (
    <label className="busca">
      <span className="sr-only">{rotulo}</span>
      <IoSearch aria-hidden size={18} />
      <input type="search" value={valor} onChange={(e) => aoMudar(e.target.value)} placeholder={placeholder ?? rotulo} />
    </label>
  );
}

export function Abas<T extends string>({
  abas,
  ativa,
  aoMudar,
  rotulo,
}: {
  abas: Array<{ id: T; titulo: string }>;
  ativa: T;
  aoMudar: (id: T) => void;
  rotulo: string;
}) {
  return (
    <div className="abas" role="tablist" aria-label={rotulo}>
      {abas.map((aba) => (
        <button
          key={aba.id}
          type="button"
          role="tab"
          aria-selected={aba.id === ativa}
          className={aba.id === ativa ? 'aba aba-ativa' : 'aba'}
          onClick={() => aoMudar(aba.id)}
        >
          {aba.titulo}
        </button>
      ))}
    </div>
  );
}

export function Detalhes({ itens }: { itens: Array<{ rotulo: string; valor: ReactNode }> }) {
  return (
    <dl className="detalhes">
      {itens.map((item) => (
        <div key={item.rotulo}>
          <dt>{item.rotulo}</dt>
          <dd>{item.valor ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}
