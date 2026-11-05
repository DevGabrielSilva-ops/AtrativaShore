import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { IoArchiveOutline, IoCheckmarkCircle, IoWarningOutline } from 'react-icons/io5';
import { HistoricoBackups } from '../../components/Backup';
import { CarregarBackup } from '../../components/CarregarBackup';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Estados';
import { Detalhes, PageHeader, Painel } from '../../components/ui/Layout';
import { Skeleton } from '../../components/ui/Spinner';
import { useAuth } from '../../contexts/AuthContext';
import { useFeedback } from '../../contexts/FeedbackContext';
import { useRequisicao } from '../../hooks/useRequisicao';
import { mensagemErro } from '../../services/api';
import { backupService, saudeService } from '../../services/servicos';
import type { Backup } from '../../types/api';
import { AlterarSenha } from './AlterarSenha';

export default function Configuracoes() {
  const { pode } = useAuth();
  return (
    <>
      <PageHeader titulo="Configurações" descricao="Senha de acesso e situação do banco de dados da empresa." />
      <div className="grade-2">
        <AlterarSenha />
        <div className="pilha">
          <EstadoSistema />
          {pode('empresa.configurar') ? (
            <Painel titulo="Dados da empresa">
              <p className="muted pequeno">Nome, endereço, desconto máximo e mensagem do comprovante.</p>
              <div className="form-acoes">
                <Link to="/empresa" className="btn btn-secundario btn-md">
                  Abrir dados da empresa
                </Link>
              </div>
            </Painel>
          ) : null}
        </div>
      </div>
      {pode('backup.gerar') || pode('backup.restaurar') ? <CopiasDeSeguranca /> : null}
    </>
  );
}

function CopiasDeSeguranca() {
  const { notificar } = useFeedback();
  const { pode } = useAuth();
  const [gerando, setGerando] = useState(false);
  const [restaurando, setRestaurando] = useState<{ chave: number; id: number | null }>({ chave: 0, id: null });
  const [versaoHistorico, setVersaoHistorico] = useState(0);
  const secao = useRef<HTMLDivElement>(null);
  const carga = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (window.location.hash === '#copias-de-seguranca') secao.current?.scrollIntoView({ block: 'start' });
    if (window.location.hash === '#carregar-backup') carga.current?.scrollIntoView({ block: 'start' });
  }, []);
  const gerar = async (recarregar: () => void) => {
    setGerando(true);
    try {
      await backupService.gerar();
      notificar('Gerando o backup. Ele aparece no histórico assim que ficar pronto.', 'info');
    } catch (erro) {
      notificar(mensagemErro(erro), 'erro');
    } finally {
      setGerando(false);
      recarregar();
    }
  };
  const restaurar = async (backup: Backup) => {
    try {
      const importacao = await backupService.restaurar(backup.id);
      setRestaurando((atual) => ({ chave: atual.chave + 1, id: importacao.id }));
      carga.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (erro) {
      notificar(mensagemErro(erro), 'erro');
    }
  };
  const concluido = useCallback(() => {
    setVersaoHistorico((v) => v + 1);
    notificar('Dados restaurados. As telas abertas mostram os dados novos ao serem recarregadas.');
  }, [notificar]);
  return (
    <div className="pilha secao-ancora">
      {pode('backup.gerar') ? (
        <div id="copias-de-seguranca" ref={secao} className="ancora">
          <Painel
            titulo="Cópias de segurança"
            descricao="Backups com os dados desta empresa, sem senhas. Cada arquivo fica disponível para download por tempo limitado."
            semEspaco
          >
            <HistoricoBackups
              servico={backupService}
              versao={versaoHistorico}
              descricaoVazio="Gere um backup aqui ou depois de fechar o caixa."
              aoRestaurar={pode('backup.restaurar') ? (backup) => void restaurar(backup) : undefined}
              acoes={(recarregar) => (
                <Button icone={<IoArchiveOutline />} carregando={gerando} onClick={() => void gerar(recarregar)}>
                  Gerar backup agora
                </Button>
              )}
            />
          </Painel>
        </div>
      ) : null}
      {pode('backup.restaurar') ? (
        <div id="carregar-backup" ref={carga} className="ancora">
          <Painel
            titulo="Carregar backup"
            descricao="Traga para esta empresa os dados de um backup do Atrativa Shore ou do sistema anterior."
          >
            <CarregarBackup key={restaurando.chave} idInicial={restaurando.id} aoConcluir={concluido} />
          </Painel>
        </div>
      ) : null}
    </div>
  );
}

function EstadoSistema() {
  const estado = useRequisicao(() => saudeService.estadoEmpresa(), []);
  const m = estado.dados?.migrations;
  const ok = (valor: boolean | undefined, texto: string) =>
    valor ? (
      <Badge tom="sucesso">
        <IoCheckmarkCircle aria-hidden /> {texto}
      </Badge>
    ) : (
      <Badge tom="aviso">
        <IoWarningOutline aria-hidden /> Pendente
      </Badge>
    );
  return (
    <Painel titulo="Banco de dados da empresa" descricao={import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1'}>
      {estado.erro ? (
        <p className="aviso-faixa erro">{estado.erro}</p>
      ) : !m ? (
        <Skeleton altura={80} />
      ) : (
        <Detalhes
          itens={[
            { rotulo: 'Conexão', valor: <Badge tom="sucesso">Conectado</Badge> },
            { rotulo: 'Transações (InnoDB)', valor: ok(m.tabelasInnodb, 'Ativas') },
            { rotulo: 'Pagamento Pix', valor: ok(m.colunaVrPix, 'Disponível') },
            { rotulo: 'Formas e juros no carnê', valor: ok(m.tabelasCarne, 'Disponível') },
            { rotulo: 'Limite do carnê', valor: ok(m.colunaLimiteCarne, 'Ativo') },
          ]}
        />
      )}
      {m && (!m.tabelasInnodb || !m.colunaVrPix || !m.colunaLimiteCarne || m.tabelasCarne === false) ? (
        <p className="pequeno muted">Itens pendentes dependem das migrations do servidor (npm run empresas:migrar).</p>
      ) : null}
    </Painel>
  );
}
