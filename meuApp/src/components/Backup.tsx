import { useEffect, useState, type ReactNode } from 'react';
import { IoAlertCircleOutline, IoArchiveOutline, IoCheckmarkCircle, IoCloudDownloadOutline } from 'react-icons/io5';
import { useFeedback } from '../contexts/FeedbackContext';
import type { GeracaoBackup } from '../hooks/useGeracaoBackup';
import { useRequisicao } from '../hooks/useRequisicao';
import { mensagemErro } from '../services/api';
import type { ServicoBackup } from '../services/servicos';
import type { Backup, StatusBackup } from '../types/api';
import { formatarDataHora, formatarInteiro, formatarTamanho } from '../utils/formatar';
import { Button } from './ui/Button';
import { DataTable } from './ui/DataTable';
import { Badge } from './ui/Estados';
import { Pagination } from './ui/Pagination';

const STATUS: Record<StatusBackup, { rotulo: string; tom: 'info' | 'sucesso' | 'perigo' | 'neutro' }> = {
  PROCESSANDO: { rotulo: 'Gerando', tom: 'info' },
  CONCLUIDO: { rotulo: 'Disponível', tom: 'sucesso' },
  FALHOU: { rotulo: 'Falhou', tom: 'perigo' },
  EXPIRADO: { rotulo: 'Expirado', tom: 'neutro' },
};

export function BarraProgresso({ valor, rotulo }: { valor: number; rotulo: string }) {
  const percentual = Math.max(0, Math.min(100, Math.round(valor)));
  return (
    <div
      className="progresso"
      role="progressbar"
      aria-label={rotulo}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percentual}
    >
      <span className="progresso-barra" style={{ width: `${Math.max(percentual, 3)}%` }} />
    </div>
  );
}

export function SecaoGeracaoBackup({ geracao, convite }: { geracao: GeracaoBackup; convite: ReactNode }) {
  const { backup, etapa, erro, semResposta } = geracao;
  return (
    <section className="secao-backup nao-imprimir" aria-live="polite">
      <div className="secao-backup-icone" aria-hidden>
        {etapa === 'pronto' ? <IoCheckmarkCircle /> : etapa === 'falhou' ? <IoAlertCircleOutline /> : <IoArchiveOutline />}
      </div>
      <div className="secao-backup-corpo">
        {etapa === 'inicial' ? (
          <>
            <p className="secao-backup-titulo">Cópia de segurança</p>
            <p className="muted pequeno">{convite}</p>
          </>
        ) : null}
        {etapa === 'gerando' && backup ? (
          <>
            <p className="secao-backup-titulo">Gerando backup… {backup.progresso}%</p>
            <BarraProgresso valor={backup.progresso} rotulo="Progresso do backup" />
            <p className="muted pequeno">
              {backup.etapa ?? 'Preparando'}. Você pode continuar usando o sistema: o backup segue sendo gerado e fica no
              histórico de cópias de segurança em Configurações.
            </p>
          </>
        ) : null}
        {etapa === 'pronto' && backup ? (
          <>
            <p className="secao-backup-titulo">Backup gerado com sucesso!</p>
            <p className="muted pequeno num">
              {backup.nomeArquivo} · {formatarTamanho(backup.tamanho)} · {formatarInteiro(backup.registros)} registros
            </p>
            {backup.expiraEm ? (
              <p className="muted pequeno">Disponível para download até {formatarDataHora(backup.expiraEm)}.</p>
            ) : null}
          </>
        ) : null}
        {etapa === 'falhou' && backup ? (
          <>
            <p className="secao-backup-titulo">Não foi possível gerar o backup</p>
            <p className="muted pequeno">
              {backup.erro ?? 'A geração foi interrompida.'} O fechamento do caixa continua registrado normalmente.
            </p>
          </>
        ) : null}
        {semResposta ? <p className="aviso-faixa">Sem resposta do servidor. Tentando novamente…</p> : null}
        {erro ? (
          <p className="aviso-faixa erro" role="alert">
            {erro}
          </p>
        ) : null}
      </div>
    </section>
  );
}

export function HistoricoBackups({
  servico,
  descricaoVazio,
  acoes,
}: {
  servico: ServicoBackup;
  descricaoVazio: string;
  acoes?: (recarregar: () => void) => ReactNode;
}) {
  const { notificar } = useFeedback();
  const [pagina, setPagina] = useState(1);
  const lista = useRequisicao(() => servico.listar({ page: pagina, limit: 10 }), [pagina, servico]);
  const [baixando, setBaixando] = useState<number | null>(null);
  const emAndamento = lista.dados?.data.some((b) => b.status === 'PROCESSANDO') ?? false;
  const { recarregar } = lista;

  useEffect(() => {
    if (!emAndamento) return;
    const id = window.setInterval(recarregar, 2000);
    return () => window.clearInterval(id);
  }, [emAndamento, recarregar]);

  const baixar = async (backup: Backup) => {
    setBaixando(backup.id);
    try {
      await servico.baixar(backup);
      notificar('Download do backup iniciado.');
      recarregar();
    } catch (erro) {
      notificar(mensagemErro(erro), 'erro');
      recarregar();
    } finally {
      setBaixando(null);
    }
  };

  return (
    <>
      {acoes ? <div className="historico-backups-acoes">{acoes(recarregar)}</div> : null}
      <DataTable<Backup>
        rotulo="Histórico de backups"
        carregando={lista.carregando && !lista.dados}
        erro={lista.erro}
        aoTentarNovamente={recarregar}
        linhas={lista.dados?.data}
        chaveLinha={(b) => b.id}
        linhasCarregando={3}
        vazio={{ titulo: 'Nenhum backup gerado ainda', descricao: descricaoVazio }}
        colunas={[
          {
            chave: 'arquivo',
            titulo: 'Arquivo',
            render: (b) => <span className="quebra-texto">{b.nomeArquivo}</span>,
          },
          { chave: 'data', titulo: 'Data e hora', render: (b) => <span className="num">{formatarDataHora(b.criadoEm)}</span> },
          { chave: 'usuario', titulo: 'Responsável', ocultarNoCelular: true, render: (b) => b.usuario?.nome ?? '—' },
          {
            chave: 'tamanho',
            titulo: 'Tamanho',
            alinhar: 'direita',
            ocultarNoCelular: true,
            render: (b) => <span className="num">{formatarTamanho(b.tamanho)}</span>,
          },
          {
            chave: 'status',
            titulo: 'Status',
            render: (b) => (
              <span className="pilha-curta">
                <Badge tom={STATUS[b.status].tom}>
                  {b.status === 'PROCESSANDO' ? `${STATUS[b.status].rotulo} ${b.progresso}%` : STATUS[b.status].rotulo}
                </Badge>
                {b.status === 'FALHOU' && b.erro ? <span className="muted pequeno">{b.erro}</span> : null}
                {b.disponivel && b.expiraEm ? (
                  <span className="muted pequeno num">até {formatarDataHora(b.expiraEm)}</span>
                ) : null}
              </span>
            ),
          },
          {
            chave: 'acoes',
            titulo: 'Download',
            alinhar: 'direita',
            render: (b) =>
              b.disponivel ? (
                <Button
                  variante="secundario"
                  tamanho="sm"
                  icone={<IoCloudDownloadOutline />}
                  carregando={baixando === b.id}
                  disabled={baixando !== null && baixando !== b.id}
                  onClick={() => void baixar(b)}
                >
                  Baixar
                </Button>
              ) : (
                <span className="muted pequeno">—</span>
              ),
          },
        ]}
      />
      <Pagination meta={lista.dados?.meta} aoMudar={setPagina} />
    </>
  );
}
