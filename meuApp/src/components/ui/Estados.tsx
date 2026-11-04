import type { ReactNode } from 'react';
import { IoCloudOfflineOutline, IoFileTrayOutline, IoRefresh } from 'react-icons/io5';
import { Button } from './Button';

export function EstadoVazio({ titulo, descricao, acao }: { titulo: string; descricao?: string; acao?: ReactNode }) {
  return (
    <div className="estado">
      <IoFileTrayOutline size={28} aria-hidden className="estado-icone" />
      <p className="estado-titulo">{titulo}</p>
      {descricao ? <p className="muted pequeno">{descricao}</p> : null}
      {acao ? <div className="estado-acao">{acao}</div> : null}
    </div>
  );
}

export function EstadoErro({ mensagem, aoTentarNovamente }: { mensagem: string; aoTentarNovamente?: () => void }) {
  return (
    <div className="estado estado-erro" role="alert">
      <IoCloudOfflineOutline size={28} aria-hidden className="estado-icone" />
      <p className="estado-titulo">Não foi possível carregar</p>
      <p className="muted pequeno">{mensagem}</p>
      {aoTentarNovamente ? (
        <div className="estado-acao">
          <Button variante="secundario" tamanho="sm" icone={<IoRefresh />} onClick={aoTentarNovamente}>
            Tentar novamente
          </Button>
        </div>
      ) : null}
    </div>
  );
}

type TomBadge = 'neutro' | 'marca' | 'sucesso' | 'aviso' | 'perigo' | 'info';

export function Badge({ tom = 'neutro', children }: { tom?: TomBadge; children: ReactNode }) {
  return <span className={`badge badge-${tom}`}>{children}</span>;
}
