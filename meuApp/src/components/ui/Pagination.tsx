import { IoChevronBack, IoChevronForward } from 'react-icons/io5';
import type { Meta } from '../../types/api';
import { formatarInteiro } from '../../utils/formatar';

export function Pagination({ meta, aoMudar }: { meta: Meta | null | undefined; aoMudar: (pagina: number) => void }) {
  if (!meta || meta.total === 0) return null;
  const inicio = (meta.page - 1) * meta.limit + 1;
  const fim = Math.min(meta.page * meta.limit, meta.total);
  return (
    <nav className="paginacao" aria-label="Paginação">
      <span className="muted pequeno num">
        {formatarInteiro(inicio)}–{formatarInteiro(fim)} de {formatarInteiro(meta.total)}
      </span>
      <div className="linha">
        <button
          type="button"
          className="btn btn-secundario btn-sm btn-icone"
          onClick={() => aoMudar(meta.page - 1)}
          disabled={meta.page <= 1}
          aria-label="Página anterior"
        >
          <IoChevronBack />
        </button>
        <span className="pequeno num" aria-live="polite">
          Página {meta.page} de {meta.totalPages}
        </span>
        <button
          type="button"
          className="btn btn-secundario btn-sm btn-icone"
          onClick={() => aoMudar(meta.page + 1)}
          disabled={meta.page >= meta.totalPages}
          aria-label="Próxima página"
        >
          <IoChevronForward />
        </button>
      </div>
    </nav>
  );
}
