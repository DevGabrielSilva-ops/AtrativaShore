import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

interface Base {
  rotulo: string;
  erro?: string;
  ajuda?: ReactNode;
  obrigatorio?: boolean;
  className?: string;
}

function Envoltorio({
  id,
  rotulo,
  erro,
  ajuda,
  obrigatorio,
  className = '',
  children,
}: Base & { id: string; children: ReactNode }) {
  return (
    <div className={`campo ${erro ? 'campo-erro' : ''} ${className}`}>
      <label htmlFor={id}>
        {rotulo}
        {obrigatorio ? <span className="campo-obrigatorio" aria-hidden> *</span> : null}
      </label>
      {children}
      {erro ? (
        <p className="campo-msg campo-msg-erro" id={`${id}-erro`}>
          {erro}
        </p>
      ) : ajuda ? (
        <p className="campo-msg" id={`${id}-ajuda`}>
          {ajuda}
        </p>
      ) : null}
    </div>
  );
}

function aria(id: string, erro?: string, ajuda?: ReactNode) {
  return {
    'aria-invalid': erro ? true : undefined,
    'aria-describedby': erro ? `${id}-erro` : ajuda ? `${id}-ajuda` : undefined,
  } as const;
}

export function Input({
  rotulo,
  erro,
  ajuda,
  obrigatorio,
  className,
  prefixo,
  ...resto
}: Base & InputHTMLAttributes<HTMLInputElement> & { prefixo?: string }) {
  const gerado = useId();
  const id = resto.id ?? gerado;
  return (
    <Envoltorio id={id} rotulo={rotulo} erro={erro} ajuda={ajuda} obrigatorio={obrigatorio} className={className}>
      <div className={prefixo ? 'entrada-com-prefixo' : undefined}>
        {prefixo ? <span className="entrada-prefixo">{prefixo}</span> : null}
        <input id={id} className="entrada" required={obrigatorio} {...aria(id, erro, ajuda)} {...resto} />
      </div>
    </Envoltorio>
  );
}

export function Select({
  rotulo,
  erro,
  ajuda,
  obrigatorio,
  className,
  children,
  ...resto
}: Base & SelectHTMLAttributes<HTMLSelectElement>) {
  const gerado = useId();
  const id = resto.id ?? gerado;
  return (
    <Envoltorio id={id} rotulo={rotulo} erro={erro} ajuda={ajuda} obrigatorio={obrigatorio} className={className}>
      <select id={id} className="entrada" required={obrigatorio} {...aria(id, erro, ajuda)} {...resto}>
        {children}
      </select>
    </Envoltorio>
  );
}

export function Textarea({
  rotulo,
  erro,
  ajuda,
  obrigatorio,
  className,
  ...resto
}: Base & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const gerado = useId();
  const id = resto.id ?? gerado;
  return (
    <Envoltorio id={id} rotulo={rotulo} erro={erro} ajuda={ajuda} obrigatorio={obrigatorio} className={className}>
      <textarea id={id} className="entrada" required={obrigatorio} rows={3} {...aria(id, erro, ajuda)} {...resto} />
    </Envoltorio>
  );
}
