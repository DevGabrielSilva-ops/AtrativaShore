import { useState } from 'react';
import { IoCheckmark, IoCopyOutline } from 'react-icons/io5';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';

export function SegredoUnico({
  titulo,
  descricao,
  valor,
  aoFechar,
}: {
  titulo: string;
  descricao: string;
  valor: string;
  aoFechar: () => void;
}) {
  const [copiado, setCopiado] = useState(false);
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(valor);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  };
  return (
    <Modal
      aberto
      titulo={titulo}
      descricao={descricao}
      aoFechar={aoFechar}
      tamanho="sm"
      rodape={
        <>
          <Button variante="secundario" icone={copiado ? <IoCheckmark /> : <IoCopyOutline />} onClick={() => void copiar()}>
            {copiado ? 'Copiado' : 'Copiar'}
          </Button>
          <Button onClick={aoFechar}>Já anotei</Button>
        </>
      }
    >
      <p className="segredo-valor" aria-live="polite">
        {valor}
      </p>
      <p className="pequeno muted">Este valor não será mostrado de novo. Entregue-o à pessoa por um canal seguro.</p>
    </Modal>
  );
}
