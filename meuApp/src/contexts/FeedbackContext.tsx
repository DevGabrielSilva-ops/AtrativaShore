import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { IoAlertCircle, IoCheckmarkCircle, IoClose, IoInformationCircle } from 'react-icons/io5';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';

type TipoToast = 'sucesso' | 'erro' | 'info';

interface Toast {
  id: number;
  tipo: TipoToast;
  mensagem: string;
}

interface OpcoesConfirmacao {
  titulo: string;
  mensagem: ReactNode;
  confirmar?: string;
  perigo?: boolean;
}

interface ValorFeedback {
  notificar: (mensagem: string, tipo?: TipoToast) => void;
  confirmar: (opcoes: OpcoesConfirmacao) => Promise<boolean>;
}

const FeedbackContexto = createContext<ValorFeedback | null>(null);

const ICONES = {
  sucesso: IoCheckmarkCircle,
  erro: IoAlertCircle,
  info: IoInformationCircle,
};

/** Notificações (toasts) e diálogo de confirmação, no lugar de alert/confirm do navegador. */
export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pergunta, setPergunta] = useState<(OpcoesConfirmacao & { resolver: (sim: boolean) => void }) | null>(null);
  const proximoId = useRef(1);

  const fechar = useCallback((id: number) => setToasts((lista) => lista.filter((t) => t.id !== id)), []);

  const notificar = useCallback(
    (mensagem: string, tipo: TipoToast = 'sucesso') => {
      const id = proximoId.current++;
      setToasts((lista) => [...lista.slice(-3), { id, tipo, mensagem }]);
      window.setTimeout(() => fechar(id), tipo === 'erro' ? 7000 : 4000);
    },
    [fechar],
  );

  const confirmar = useCallback(
    (opcoes: OpcoesConfirmacao) => new Promise<boolean>((resolver) => setPergunta({ ...opcoes, resolver })),
    [],
  );

  const responder = (sim: boolean) => {
    pergunta?.resolver(sim);
    setPergunta(null);
  };

  const valor = useMemo(() => ({ notificar, confirmar }), [notificar, confirmar]);

  return (
    <FeedbackContexto.Provider value={valor}>
      {children}
      <div className="toasts" role="region" aria-label="Notificações">
        {toasts.map((toast) => {
          const Icone = ICONES[toast.tipo];
          return (
            <div key={toast.id} className={`toast toast-${toast.tipo}`} role={toast.tipo === 'erro' ? 'alert' : 'status'}>
              <Icone size={20} aria-hidden />
              <p>{toast.mensagem}</p>
              <button type="button" className="toast-fechar" onClick={() => fechar(toast.id)} aria-label="Fechar notificação">
                <IoClose size={16} />
              </button>
            </div>
          );
        })}
      </div>
      <Modal
        aberto={pergunta !== null}
        titulo={pergunta?.titulo ?? ''}
        aoFechar={() => responder(false)}
        tamanho="sm"
        rodape={
          <>
            <Button variante="secundario" onClick={() => responder(false)}>
              Cancelar
            </Button>
            <Button variante={pergunta?.perigo ? 'perigo' : 'primario'} onClick={() => responder(true)} autoFocus>
              {pergunta?.confirmar ?? 'Confirmar'}
            </Button>
          </>
        }
      >
        <div className="muted">{pergunta?.mensagem}</div>
      </Modal>
    </FeedbackContexto.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useFeedback(): ValorFeedback {
  const contexto = useContext(FeedbackContexto);
  if (!contexto) throw new Error('useFeedback precisa estar dentro de <FeedbackProvider>');
  return contexto;
}
