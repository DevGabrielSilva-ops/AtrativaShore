import { useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  IoArchiveOutline,
  IoCloudDownloadOutline,
  IoLockClosedOutline,
  IoLockOpenOutline,
  IoPrintOutline,
} from 'react-icons/io5';
import { SecaoGeracaoBackup } from '../../components/Backup';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { Badge, EstadoErro } from '../../components/ui/Estados';
import { Input } from '../../components/ui/Field';
import { Indicador, PageHeader, Painel } from '../../components/ui/Layout';
import { Modal } from '../../components/ui/Modal';
import { Pagination } from '../../components/ui/Pagination';
import { Skeleton } from '../../components/ui/Spinner';
import { useAuth } from '../../contexts/AuthContext';
import { useFeedback } from '../../contexts/FeedbackContext';
import { useGeracaoBackup } from '../../hooks/useGeracaoBackup';
import { useAcao, useRequisicao } from '../../hooks/useRequisicao';
import { mensagemErro } from '../../services/api';
import { backupService, caixaService } from '../../services/servicos';
import type { Caixa as TipoCaixa, CaixaComResumo, MovimentoCaixa, ResumoCaixa } from '../../types/api';
import { imprimir } from '../../utils/exportar';
import { formatarData, formatarMoeda, lerNumero } from '../../utils/formatar';

export default function Caixa() {
  const { notificar } = useFeedback();
  const { pode } = useAuth();
  const atual = useRequisicao(() => caixaService.atual(), []);
  const [paginaHistorico, setPaginaHistorico] = useState(1);
  const historico = useRequisicao(() => caixaService.historico({ page: paginaHistorico, limit: 10 }), [paginaHistorico]);
  const [fechando, setFechando] = useState(false);
  const [fechado, setFechado] = useState<(CaixaComResumo & { valorProximoDia: number | null }) | null>(null);
  const [vendo, setVendo] = useState<number | null>(null);

  const caixa = atual.dados;

  return (
    <>
      <PageHeader
        titulo="Caixa"
        descricao="Abertura, acompanhamento e fechamento do caixa deste terminal."
        acoes={
          <>
            {pode('backup.gerar') ? (
              <Link to="/configuracoes#copias-de-seguranca" className="btn btn-secundario btn-md">
                <IoArchiveOutline aria-hidden />
                <span>Cópias de segurança</span>
              </Link>
            ) : null}
            {caixa ? (
              <Button variante="perigo" icone={<IoLockClosedOutline />} onClick={() => setFechando(true)}>
                Fechar caixa
              </Button>
            ) : null}
          </>
        }
      />
      <div className="pilha">
        {atual.erro ? (
          <Painel>
            <EstadoErro mensagem={atual.erro} aoTentarNovamente={atual.recarregar} />
          </Painel>
        ) : atual.carregando && !caixa ? (
          <Painel>
            <Skeleton altura={120} />
          </Painel>
        ) : caixa ? (
          <>
            <div className="linha">
              <Badge tom="sucesso">Caixa aberto</Badge>
              <span className="muted pequeno num">
                Terminal {caixa.terminal} · aberto em {formatarData(caixa.abertura.data)} às {caixa.abertura.hora} com{' '}
                {formatarMoeda(caixa.abertura.valor)}
              </span>
            </div>
            <ResumoCaixaPainel resumo={caixa.resumo} valorAbertura={caixa.abertura.valor} />
          </>
        ) : (
          <AbrirCaixa
            aoAbrir={() => {
              notificar('Caixa aberto.');
              atual.recarregar();
              historico.recarregar();
            }}
          />
        )}

        <Painel titulo="Caixas anteriores" semEspaco>
          <DataTable<TipoCaixa>
            rotulo="Caixas anteriores"
            carregando={historico.carregando}
            erro={historico.erro}
            aoTentarNovamente={historico.recarregar}
            linhas={historico.dados?.data}
            chaveLinha={(c) => c.id}
            aoClicarLinha={(c) => setVendo(c.id)}
            linhasCarregando={4}
            vazio={{ titulo: 'Nenhum caixa registrado neste terminal' }}
            colunas={[
              { chave: 'abertura', titulo: 'Abertura', render: (c) => <span className="num">{formatarData(c.abertura.data)} {c.abertura.hora?.slice(0, 5)}</span> },
              {
                chave: 'fechamento',
                titulo: 'Fechamento',
                render: (c) => (c.aberto ? <Badge tom="sucesso">Aberto</Badge> : <span className="num">{formatarData(c.fechamento.data)} {c.fechamento.hora?.slice(0, 5)}</span>),
              },
              { chave: 'inicial', titulo: 'Valor inicial', alinhar: 'direita', ocultarNoCelular: true, render: (c) => formatarMoeda(c.abertura.valor) },
              { chave: 'total', titulo: 'Total recebido', alinhar: 'direita', render: (c) => formatarMoeda(c.fechamento.valor) },
            ]}
          />
          <Pagination meta={historico.dados?.meta} aoMudar={setPaginaHistorico} />
        </Painel>
      </div>

      {fechando && caixa ? (
        <FecharCaixa
          caixa={caixa}
          aoFechar={() => setFechando(false)}
          aoConcluir={(resultado) => {
            setFechando(false);
            setFechado(resultado);
            notificar('Caixa fechado.');
            atual.recarregar();
            historico.recarregar();
          }}
        />
      ) : null}

      {fechado ? <CaixaFechado fechado={fechado} aoFechar={() => setFechado(null)} /> : null}

      {vendo ? <DetalheCaixa id={vendo} aoFechar={() => setVendo(null)} /> : null}
    </>
  );
}

function ResumoCaixaPainel({ resumo, valorAbertura, compacto = false }: { resumo: ResumoCaixa; valorAbertura: number | null; compacto?: boolean }) {
  const recebimentos = {
    ...resumo.recebimentosCarne,
    dinheiro: resumo.recebimentosCarne.dinheiro ?? resumo.recebimentosCarne.total,
    pix: resumo.recebimentosCarne.pix ?? 0,
    cartao: resumo.recebimentosCarne.cartao ?? 0,
  };
  const entradas = resumo.entradas ?? {
    dinheiro: resumo.vendas.dinheiro + recebimentos.dinheiro,
    pix: resumo.vendas.pix,
    cartao: resumo.vendas.cartao,
    outros: resumo.vendas.outros,
    total: resumo.totalRecebido,
  };
  return (
    <div className="pilha">
      <div className="indicadores">
        <Indicador rotulo="Total recebido" valor={formatarMoeda(resumo.totalRecebido)} nota="Dinheiro, Pix, cartão e carnês recebidos" />
        <Indicador rotulo="Dinheiro esperado na gaveta" valor={formatarMoeda(resumo.dinheiroEsperadoNaGaveta)} nota={`Inclui ${formatarMoeda(valorAbertura)} de troco inicial`} />
        <Indicador rotulo="Vendas" valor={resumo.quantidadeVendas} nota={`${formatarMoeda(resumo.vendas.total)} vendidos`} />
        <Indicador rotulo="Vendido no carnê" valor={formatarMoeda(resumo.vendas.carne)} nota="A receber nas próximas parcelas" />
      </div>
      <div className="grade-2">
        <Painel titulo="Por forma de pagamento">
          <dl className="cupom-linhas sem-borda">
            {(
              [
                ['Dinheiro', entradas.dinheiro],
                ['Pix', entradas.pix],
                ['Cartão', entradas.cartao],
                ['Carnê (vendas a prazo)', resumo.vendas.carne],
                ['Cheque/ticket', entradas.outros],
                ['Descontos concedidos', resumo.descontos],
              ] as const
            ).map(([nome, valor]) => (
              <div key={nome}>
                <dt>{nome}</dt>
                <dd className="num">{formatarMoeda(valor)}</dd>
              </div>
            ))}
          </dl>
          {recebimentos.quantidade > 0 ? (
            <p className="pequeno muted num">
              Inclui {recebimentos.quantidade} recebimento{recebimentos.quantidade > 1 ? 's' : ''} de carnê ({formatarMoeda(recebimentos.total)}):{' '}
              {(
                [
                  ['dinheiro', recebimentos.dinheiro],
                  ['Pix', recebimentos.pix],
                  ['cartão', recebimentos.cartao],
                ] as const
              )
                .filter(([, valor]) => (valor ?? 0) > 0)
                .map(([nome, valor]) => `${nome} ${formatarMoeda(valor)}`)
                .join(' · ')}
              .
            </p>
          ) : null}
        </Painel>
        {!compacto ? (
          <Painel titulo="Movimentações" descricao={`${formatarData(resumo.periodo.inicio)} a ${formatarData(resumo.periodo.fim)}`} semEspaco>
            <DataTable<MovimentoCaixa>
              rotulo="Movimentações do caixa"
              linhas={resumo.movimentos.slice(0, 30)}
              chaveLinha={(m) => `${m.tipo}-${m.controle}`}
              linhasCarregando={4}
              vazio={{ titulo: 'Nenhuma movimentação ainda' }}
              colunas={[
                { chave: 'hora', titulo: 'Hora', render: (m) => <span className="num">{m.hora?.slice(0, 5)}</span> },
                { chave: 'desc', titulo: 'Descrição', render: (m) => m.descricao },
                { chave: 'valor', titulo: 'Valor', alinhar: 'direita', render: (m) => formatarMoeda(m.valor) },
              ]}
            />
          </Painel>
        ) : null}
      </div>
    </div>
  );
}

function CaixaFechado({
  fechado,
  aoFechar,
}: {
  fechado: CaixaComResumo & { valorProximoDia: number | null };
  aoFechar: () => void;
}) {
  const { pode } = useAuth();
  const { notificar } = useFeedback();
  const geracao = useGeracaoBackup(backupService);
  const podeBackup = pode('backup.gerar');

  const fechar = () => {
    if (geracao.etapa === 'gerando') notificar('O backup continua sendo gerado. Baixe-o em Configurações quando ficar pronto.', 'info');
    aoFechar();
  };

  const baixar = async () => {
    if (await geracao.baixar()) notificar('Download do backup iniciado.');
  };

  let acoesBackup: ReactNode = <Button onClick={fechar}>Concluir</Button>;
  if (podeBackup) {
    if (geracao.etapa === 'inicial') {
      acoesBackup = (
        <>
          <Button variante="fantasma" onClick={fechar}>
            Fazer isso depois
          </Button>
          <Button icone={<IoArchiveOutline />} carregando={geracao.iniciando} onClick={() => void geracao.gerar()}>
            Gerar backup
          </Button>
        </>
      );
    } else if (geracao.etapa === 'gerando') {
      acoesBackup = <Button onClick={fechar}>Continuar usando o sistema</Button>;
    } else if (geracao.etapa === 'pronto') {
      acoesBackup = (
        <>
          <Button variante="fantasma" onClick={fechar}>
            Concluir
          </Button>
          <Button icone={<IoCloudDownloadOutline />} carregando={geracao.baixando} onClick={() => void baixar()}>
            Baixar backup
          </Button>
        </>
      );
    } else {
      acoesBackup = (
        <>
          <Button variante="fantasma" onClick={fechar}>
            Fechar
          </Button>
          <Button icone={<IoArchiveOutline />} carregando={geracao.iniciando} onClick={() => void geracao.gerar()}>
            Tentar novamente
          </Button>
        </>
      );
    }
  }

  return (
    <Modal
      aberto
      titulo="Caixa fechado com sucesso!"
      descricao={`Seu fechamento foi registrado em ${formatarData(fechado.fechamento.data)} às ${fechado.fechamento.hora}.`}
      aoFechar={fechar}
      tamanho="lg"
      rodape={
        <>
          <Button variante="secundario" icone={<IoPrintOutline />} onClick={imprimir}>
            Imprimir / salvar PDF
          </Button>
          {acoesBackup}
        </>
      }
    >
      <div className="pilha">
        {podeBackup ? (
          <SecaoGeracaoBackup
            geracao={geracao}
            convite="Deseja gerar uma cópia de segurança dos dados da empresa? O arquivo ZIP é baixado direto para este computador."
          />
        ) : null}
        <div className="area-impressao pilha">
          <ResumoCaixaPainel resumo={fechado.resumo} valorAbertura={fechado.abertura.valor} compacto />
          {fechado.valorProximoDia != null ? (
            <p className="pequeno">
              Valor deixado para o próximo dia: <strong className="num">{formatarMoeda(fechado.valorProximoDia)}</strong>
            </p>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}

function AbrirCaixa({ aoAbrir }: { aoAbrir: () => void }) {
  const [valor, setValor] = useState('');
  const [erro, setErro] = useState<string | undefined>();
  const abrir = useAcao(async () => {
    try {
      await caixaService.abrir(lerNumero(valor) ?? 0);
      aoAbrir();
    } catch (falha) {
      setErro(mensagemErro(falha));
    }
  });
  const enviar = (evento: FormEvent) => {
    evento.preventDefault();
    const numero = lerNumero(valor || '0');
    if (numero == null || numero < 0) return setErro('Informe um valor válido.');
    void abrir.executar();
  };
  return (
    <Painel titulo="O caixa está fechado" descricao="Abra o caixa para registrar vendas e receber carnês neste terminal.">
      <form className="linha abrir-caixa" onSubmit={enviar} noValidate>
        <Input rotulo="Troco inicial na gaveta" prefixo="R$" inputMode="decimal" placeholder="0,00" value={valor} onChange={(e) => setValor(e.target.value)} erro={erro} autoFocus />
        <Button type="submit" icone={<IoLockOpenOutline />} carregando={abrir.executando}>
          Abrir caixa
        </Button>
      </form>
    </Painel>
  );
}

function FecharCaixa({
  caixa,
  aoFechar,
  aoConcluir,
}: {
  caixa: CaixaComResumo;
  aoFechar: () => void;
  aoConcluir: (resultado: CaixaComResumo & { valorProximoDia: number | null }) => void;
}) {
  const [proximoDia, setProximoDia] = useState('');
  const [falha, setFalha] = useState<string | null>(null);
  const fechar = useAcao(async () => {
    try {
      aoConcluir(await caixaService.fechar(proximoDia.trim() ? (lerNumero(proximoDia) ?? undefined) : undefined));
    } catch (erro) {
      setFalha(mensagemErro(erro));
    }
  });
  const r = caixa.resumo;
  return (
    <Modal
      aberto
      titulo="Fechar caixa"
      descricao={`Aberto em ${formatarData(caixa.abertura.data)} às ${caixa.abertura.hora}`}
      aoFechar={aoFechar}
      rodape={
        <>
          <Button variante="secundario" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button variante="perigo" onClick={() => void fechar.executar()} carregando={fechar.executando}>
            Fechar caixa
          </Button>
        </>
      }
    >
      <div className="pilha">
        {falha ? (
          <p className="aviso-faixa erro" role="alert">
            {falha}
          </p>
        ) : null}
        <dl className="cupom-linhas">
          <div>
            <dt>Dinheiro</dt>
            <dd className="num">{formatarMoeda(r.vendas.dinheiro)}</dd>
          </div>
          <div>
            <dt>Pix</dt>
            <dd className="num">{formatarMoeda(r.vendas.pix)}</dd>
          </div>
          <div>
            <dt>Cartão</dt>
            <dd className="num">{formatarMoeda(r.vendas.cartao)}</dd>
          </div>
          <div>
            <dt>Recebimentos de carnê</dt>
            <dd className="num">{formatarMoeda(r.recebimentosCarne.total)}</dd>
          </div>
          <div>
            <dt>Vendas no carnê (a receber)</dt>
            <dd className="num">{formatarMoeda(r.vendas.carne)}</dd>
          </div>
          <div className="revisao-total">
            <dt>Total do fechamento</dt>
            <dd className="num">{formatarMoeda(r.totalRecebido)}</dd>
          </div>
        </dl>
        <Input
          rotulo="Valor que fica na gaveta para o próximo dia"
          prefixo="R$"
          inputMode="decimal"
          placeholder="0,00"
          value={proximoDia}
          onChange={(e) => setProximoDia(e.target.value)}
          ajuda="Aparece no comprovante; o banco não guarda este valor."
        />
      </div>
    </Modal>
  );
}

function DetalheCaixa({ id, aoFechar }: { id: number; aoFechar: () => void }) {
  const caixa = useRequisicao(() => caixaService.obter(id), [id]);
  return (
    <Modal
      aberto
      titulo={caixa.dados ? `Caixa de ${formatarData(caixa.dados.abertura.data)}` : 'Caixa'}
      aoFechar={aoFechar}
      tamanho="lg"
      rodape={
        <Button variante="secundario" icone={<IoPrintOutline />} onClick={imprimir}>
          Imprimir
        </Button>
      }
    >
      {caixa.erro ? (
        <EstadoErro mensagem={caixa.erro} aoTentarNovamente={caixa.recarregar} />
      ) : caixa.dados ? (
        <div className="area-impressao">
          <ResumoCaixaPainel resumo={caixa.dados.resumo} valorAbertura={caixa.dados.abertura.valor} compacto />
        </div>
      ) : (
        <Skeleton altura={200} />
      )}
    </Modal>
  );
}
