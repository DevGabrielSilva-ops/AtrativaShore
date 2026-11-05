import { useCallback, useEffect, useId, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import {
  IoAlertCircleOutline,
  IoCheckmark,
  IoCheckmarkCircle,
  IoCloudUploadOutline,
  IoCopyOutline,
  IoDocumentOutline,
  IoKeyOutline,
  IoRefreshOutline,
  IoWarningOutline,
} from 'react-icons/io5';
import { useFeedback } from '../contexts/FeedbackContext';
import { ROTULOS_PAPEL } from '../pages/compartilhado';
import { mensagemErro } from '../services/api';
import { backupService, importacaoService } from '../services/servicos';
import type { Importacao, SenhaImportada } from '../types/api';
import { formatarDataHora, formatarInteiro, formatarTamanho } from '../utils/formatar';
import { BarraProgresso } from './Backup';
import { Button } from './ui/Button';
import { DataTable } from './ui/DataTable';
import { Badge } from './ui/Estados';
import { Input } from './ui/Field';
import { Modal } from './ui/Modal';

const PALAVRA = 'SUBSTITUIR';
const EM_ANDAMENTO = ['ANALISANDO', 'PROCESSANDO'];

export function CarregarBackup({ idInicial, aoConcluir }: { idInicial?: number | null; aoConcluir?: () => void }) {
  const { notificar } = useFeedback();
  const [importacao, setImportacao] = useState<Importacao | null>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [envio, setEnvio] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmacao, setConfirmacao] = useState('');
  const [executando, setExecutando] = useState(false);
  const [senhas, setSenhas] = useState<SenhaImportada[] | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);
  const idEntrada = useId();
  const avisouConclusao = useRef<number | null>(null);

  useEffect(() => {
    let ativo = true;
    const carregar = idInicial
      ? importacaoService.obter(idInicial)
      : importacaoService.listar({ limit: 1 }).then((lista) => {
          const ultima = lista.data[0];
          if (!ultima) return null;
          const recente = Date.now() - new Date(ultima.criadoEm.replace(' ', 'T')).getTime() < 6 * 3600 * 1000;
          return ['ANALISANDO', 'PRONTO', 'PROCESSANDO'].includes(ultima.status) || (recente && ultima.senhasDisponiveis) ? ultima : null;
        });
    carregar.then((dados) => ativo && setImportacao(dados)).catch(() => undefined);
    return () => {
      ativo = false;
    };
  }, [idInicial]);

  const id = importacao?.id;
  const andamento = importacao ? EM_ANDAMENTO.includes(importacao.status) : false;
  useEffect(() => {
    if (!andamento || id === undefined) return;
    let ativo = true;
    let temporizador = 0;
    const consultar = async () => {
      try {
        const atual = await importacaoService.obter(id);
        if (!ativo) return;
        setImportacao(atual);
        if (EM_ANDAMENTO.includes(atual.status)) temporizador = window.setTimeout(consultar, 1000);
      } catch {
        if (ativo) temporizador = window.setTimeout(consultar, 3000);
      }
    };
    temporizador = window.setTimeout(consultar, 800);
    return () => {
      ativo = false;
      window.clearTimeout(temporizador);
    };
  }, [id, andamento]);

  useEffect(() => {
    if (importacao?.status === 'CONCLUIDO' && avisouConclusao.current !== importacao.id && importacao.confirmadoEm) {
      avisouConclusao.current = importacao.id;
      aoConcluir?.();
    }
  }, [importacao, aoConcluir]);

  const recomecar = useCallback(() => {
    setImportacao(null);
    setArquivo(null);
    setEnvio(null);
    setErro(null);
    setConfirmacao('');
  }, []);

  const escolher = (lista: FileList | null) => {
    const escolhido = lista?.[0] ?? null;
    setErro(null);
    if (escolhido && !/\.(zip|sql)$/i.test(escolhido.name)) {
      setArquivo(null);
      setErro('Escolha um backup .zip do Atrativa Shore ou um dump .sql do MySQL.');
      return;
    }
    setArquivo(escolhido);
  };

  const enviar = async () => {
    if (!arquivo) return;
    setErro(null);
    setEnvio(0);
    try {
      setImportacao(await importacaoService.enviar(arquivo, setEnvio));
      setArquivo(null);
    } catch (falha) {
      setErro(mensagemErro(falha));
    } finally {
      setEnvio(null);
    }
  };

  const acao = async (executar: () => Promise<Importacao>) => {
    setExecutando(true);
    setErro(null);
    try {
      setImportacao(await executar());
      setConfirmacao('');
    } catch (falha) {
      setErro(mensagemErro(falha));
    } finally {
      setExecutando(false);
    }
  };

  const verSenhas = async () => {
    if (!importacao) return;
    try {
      setSenhas(await importacaoService.senhas(importacao.id));
      setImportacao({ ...importacao, senhasDisponiveis: false });
    } catch (falha) {
      notificar(mensagemErro(falha), 'erro');
    }
  };

  const soltar = (evento: DragEvent<HTMLLabelElement>) => {
    evento.preventDefault();
    setArrastando(false);
    escolher(evento.dataTransfer.files);
  };

  const falha = erro ? (
    <p className="aviso-faixa erro" role="alert">
      <IoAlertCircleOutline aria-hidden />
      <span>{erro}</span>
    </p>
  ) : null;

  if (!importacao || importacao.status === 'CANCELADO' || importacao.status === 'EXPIRADO') {
    return (
      <div className="carregar-backup pilha">
        <label
          htmlFor={idEntrada}
          className={`zona-arquivo${arrastando ? ' zona-arquivo-ativa' : ''}`}
          onDragOver={(evento) => {
            evento.preventDefault();
            setArrastando(true);
          }}
          onDragLeave={() => setArrastando(false)}
          onDrop={soltar}
        >
          <IoCloudUploadOutline aria-hidden className="zona-arquivo-icone" />
          {arquivo ? (
            <span className="zona-arquivo-nome">
              <IoDocumentOutline aria-hidden /> {arquivo.name} <span className="muted num">· {formatarTamanho(arquivo.size)}</span>
            </span>
          ) : (
            <span>
              <strong>Escolha o arquivo</strong> ou arraste-o para cá
            </span>
          )}
          <span className="muted pequeno">Backup .zip do Atrativa Shore ou dump .sql do sistema anterior (MySQL)</span>
          <input
            ref={entrada}
            id={idEntrada}
            type="file"
            accept=".zip,.sql,application/zip,application/sql"
            className="sr-only"
            onChange={(evento: ChangeEvent<HTMLInputElement>) => escolher(evento.target.files)}
          />
        </label>
        {envio !== null ? <BarraProgresso valor={envio} rotulo="Envio do arquivo" /> : null}
        {falha}
        <p className="muted pequeno">
          O arquivo é analisado primeiro e nada é alterado antes da sua confirmação. Ao confirmar, os dados atuais da empresa são
          substituídos pelos do arquivo, depois de um backup de segurança automático.
        </p>
        <div className="form-acoes">
          {arquivo ? (
            <Button variante="fantasma" onClick={recomecar} disabled={envio !== null}>
              Trocar arquivo
            </Button>
          ) : null}
          <Button icone={<IoCloudUploadOutline />} disabled={!arquivo} carregando={envio !== null} onClick={() => void enviar()}>
            {envio !== null ? `Enviando ${envio}%` : 'Enviar e analisar'}
          </Button>
        </div>
      </div>
    );
  }

  if (importacao.status === 'ANALISANDO' || importacao.status === 'PROCESSANDO') {
    const restaurando = importacao.status === 'PROCESSANDO';
    return (
      <div className="carregar-backup pilha" aria-live="polite">
        <p className="secao-backup-titulo">
          {restaurando ? 'Restaurando os dados…' : 'Analisando o arquivo…'} {importacao.progresso}%
        </p>
        <BarraProgresso valor={importacao.progresso} rotulo={restaurando ? 'Progresso da restauração' : 'Progresso da análise'} />
        <p className="muted pequeno">
          {importacao.etapa ?? 'Preparando'}.{' '}
          {restaurando
            ? 'Enquanto isso, vendas e outras alterações nesta empresa ficam bloqueadas. Não feche o servidor.'
            : 'Nenhum dado é alterado nesta etapa.'}
        </p>
      </div>
    );
  }

  if (importacao.status === 'PRONTO' && importacao.analise) {
    const analise = importacao.analise;
    const substituir = analise.tabelas.filter((t) => t.acao === 'SUBSTITUIR');
    return (
      <div className="carregar-backup pilha">
        <div className="resumo-importacao">
          <div>
            <p className="secao-backup-titulo">{importacao.nomeArquivo}</p>
            <p className="muted pequeno num">
              {analise.origem === 'BACKUP_ATRATIVA' ? 'Backup do Atrativa Shore' : 'Dump SQL'}
              {analise.metadados?.empresa ? ` de ${analise.metadados.empresa.nome}` : ''}
              {analise.metadados?.geradoEm ? `, gerado em ${formatarDataHora(analise.metadados.geradoEm)}` : ''} ·{' '}
              {formatarTamanho(importacao.tamanho)}
            </p>
          </div>
          <div className="resumo-importacao-numeros">
            <span>
              <strong className="num">{formatarInteiro(analise.registros)}</strong> registros
            </span>
            <span>
              <strong className="num">{substituir.length}</strong> tabelas
            </span>
          </div>
        </div>

        {analise.avisos.map((aviso) => (
          <p key={aviso} className="aviso-faixa">
            <IoWarningOutline aria-hidden />
            <span>{aviso}</span>
          </p>
        ))}

        <div className="tabela-importacao">
          <DataTable
            rotulo="Tabelas do arquivo"
            linhas={analise.tabelas}
            chaveLinha={(t) => t.tabela}
            colunas={[
              { chave: 'tabela', titulo: 'Tabela', render: (t) => <code>{t.tabela}</code> },
              { chave: 'registros', titulo: 'Registros', alinhar: 'direita', render: (t) => <span className="num">{formatarInteiro(t.registros)}</span> },
              {
                chave: 'acao',
                titulo: 'O que acontece',
                render: (t) =>
                  t.acao === 'SUBSTITUIR' ? (
                    <span className="pilha-curta">
                      <Badge tom="aviso">Substituir</Badge>
                      {t.colunasSemValor.length ? (
                        <span className="muted pequeno">Ficam vazias: {t.colunasSemValor.join(', ')}</span>
                      ) : null}
                    </span>
                  ) : (
                    <span className="pilha-curta">
                      <Badge tom="neutro">Ignorar</Badge>
                      {t.motivo ? <span className="muted pequeno">{t.motivo}</span> : null}
                    </span>
                  ),
              },
            ]}
          />
        </div>

        {analise.usuariosParaCriar.length ? (
          <p className="aviso-faixa info">
            <IoKeyOutline aria-hidden />
            <span>
              {analise.usuariosParaCriar.length === 1 ? 'O usuário' : 'Os usuários'}{' '}
              {analise.usuariosParaCriar.map((u) => `${u.login ?? `#${u.id}`} (${ROTULOS_PAPEL[u.papel]})`).join(', ')}{' '}
              do sistema anterior {analise.usuariosParaCriar.length === 1 ? 'vira funcionário' : 'viram funcionários'} com senha
              temporária, mostrada ao final.
            </span>
          </p>
        ) : null}

        <div className="confirmacao-perigosa">
          <p>
            <strong>Os dados atuais de {substituir.length} tabelas serão apagados e substituídos pelos do arquivo.</strong> Antes disso o
            sistema gera um backup de segurança desta empresa, que fica disponível por 7 dias no histórico acima.
          </p>
          <Input
            rotulo={`Para confirmar, digite ${PALAVRA}`}
            value={confirmacao}
            onChange={(evento) => setConfirmacao(evento.target.value.toUpperCase())}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        {falha}
        <div className="form-acoes">
          <Button variante="fantasma" disabled={executando} onClick={() => void acao(() => importacaoService.cancelar(importacao.id))}>
            Cancelar
          </Button>
          <Button
            variante="perigo"
            disabled={confirmacao !== PALAVRA}
            carregando={executando}
            onClick={() => void acao(() => importacaoService.confirmar(importacao.id))}
          >
            Substituir dados
          </Button>
        </div>
      </div>
    );
  }

  if (importacao.status === 'CONCLUIDO' && importacao.resultado) {
    const resultado = importacao.resultado;
    return (
      <div className="carregar-backup pilha">
        <section className="secao-backup">
          <div className="secao-backup-icone" aria-hidden>
            <IoCheckmarkCircle />
          </div>
          <div className="secao-backup-corpo">
            <p className="secao-backup-titulo">Dados restaurados com sucesso!</p>
            <p className="muted pequeno">
              {formatarInteiro(resultado.registros)} registros em {resultado.tabelas.length} tabelas, a partir de {importacao.nomeArquivo}.
              {importacao.idBackupSeguranca ? ` O estado anterior foi guardado no backup de segurança #${importacao.idBackupSeguranca}.` : ''}
            </p>
          </div>
        </section>
        {resultado.usuariosCriados.length ? (
          <div className="pilha">
            <p className="pequeno">
              Funcionários criados a partir do sistema anterior:{' '}
              {resultado.usuariosCriados.map((u) => `${u.login} (${ROTULOS_PAPEL[u.papel]}${u.status === 'INACTIVE' ? ', inativo pelo limite do plano' : ''})`).join(', ')}.
            </p>
            {importacao.senhasDisponiveis ? (
              <div>
                <Button icone={<IoKeyOutline />} onClick={() => void verSenhas()}>
                  Ver senhas temporárias
                </Button>
              </div>
            ) : (
              <p className="muted pequeno">As senhas temporárias já foram exibidas. Se precisar, gere outra em Funcionários.</p>
            )}
          </div>
        ) : null}
        <div className="form-acoes">
          <Button variante="secundario" onClick={recomecar}>
            Carregar outro arquivo
          </Button>
        </div>
        {senhas ? <SenhasTemporarias senhas={senhas} aoFechar={() => setSenhas(null)} /> : null}
      </div>
    );
  }

  return (
    <div className="carregar-backup pilha">
      <p className="aviso-faixa erro" role="alert">
        <IoAlertCircleOutline aria-hidden />
        <span>{importacao.erro ?? 'A importação não foi concluída.'}</span>
      </p>
      {falha}
      <div className="form-acoes">
        <Button variante="secundario" onClick={recomecar}>
          Escolher outro arquivo
        </Button>
        {importacao.idBackupSeguranca && importacao.confirmadoEm ? (
          <Button
            icone={<IoRefreshOutline />}
            carregando={executando}
            onClick={() => void acao(() => backupService.restaurar(importacao.idBackupSeguranca!))}
          >
            Restaurar backup de segurança
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function SenhasTemporarias({ senhas, aoFechar }: { senhas: SenhaImportada[]; aoFechar: () => void }) {
  const [copiado, setCopiado] = useState(false);
  const texto = senhas.map((s) => `${s.login}: ${s.senhaTemporaria}`).join('\n');
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  };
  return (
    <Modal
      aberto
      titulo="Senhas temporárias"
      descricao="Anote ou copie agora: elas não serão mostradas de novo. No primeiro acesso, cada funcionário define a própria senha."
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
      <ul className="lista-senhas">
        {senhas.map((s) => (
          <li key={s.id}>
            <span>{s.login}</span>
            <code className="num">{s.senhaTemporaria}</code>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
