import { useState } from 'react';
import { IoArchiveOutline, IoWarningOutline } from 'react-icons/io5';
import { HistoricoBackups } from '../../components/Backup';
import { Button } from '../../components/ui/Button';
import { PageHeader, Painel } from '../../components/ui/Layout';
import { useFeedback } from '../../contexts/FeedbackContext';
import { mensagemErro } from '../../services/api';
import { backupPlataformaService } from '../../services/servicos';

export default function BackupsPlataforma() {
  const { notificar } = useFeedback();
  const [gerando, setGerando] = useState(false);

  const gerar = async (recarregar: () => void) => {
    setGerando(true);
    try {
      await backupPlataformaService.gerar();
      notificar('Gerando o backup completo. Acompanhe o progresso no histórico.', 'info');
    } catch (erro) {
      notificar(mensagemErro(erro), 'erro');
    } finally {
      setGerando(false);
      recarregar();
    }
  };

  return (
    <>
      <PageHeader
        titulo="Backups da plataforma"
        descricao="Cópia completa do banco central e dos bancos de todas as empresas, em scripts SQL."
      />
      <div className="pilha">
        <p className="aviso-faixa">
          <IoWarningOutline aria-hidden />
          <span>
            O backup global contém os dados de todas as empresas, incluindo hashes de senha. Guarde o arquivo em local
            protegido. Os backups das empresas são gerados por cada uma e não aparecem aqui.
          </span>
        </p>
        <Painel titulo="Histórico" semEspaco>
          <HistoricoBackups
            servico={backupPlataformaService}
            descricaoVazio="Gere o primeiro backup completo da plataforma."
            acoes={(recarregar) => (
              <Button icone={<IoArchiveOutline />} carregando={gerando} onClick={() => void gerar(recarregar)}>
                Gerar backup completo
              </Button>
            )}
          />
        </Painel>
      </div>
    </>
  );
}
