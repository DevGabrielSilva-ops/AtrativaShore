import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { IoAddCircleOutline, IoArrowUndoOutline, IoDocumentTextOutline, IoDownloadOutline, IoPrintOutline } from 'react-icons/io5';
import { SeletorBusca } from '../../components/SeletorBusca';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { Badge, EstadoErro } from '../../components/ui/Estados';
import { FiltroPeriodo, type Periodo } from '../../components/ui/FiltroPeriodo';
import { periodoDoMes } from '../../utils/periodo';
import { Detalhes, PageHeader, Painel } from '../../components/ui/Layout';
import { Modal } from '../../components/ui/Modal';
import { Pagination } from '../../components/ui/Pagination';
import { Skeleton } from '../../components/ui/Spinner';
import { useAuth } from '../../contexts/AuthContext';
import { useFeedback } from '../../contexts/FeedbackContext';
import { useAcao, useRequisicao } from '../../hooks/useRequisicao';
import { usePagina } from '../../hooks/useEstadoReiniciado';
import { mensagemErro } from '../../services/api';
import { clienteService, vendaService } from '../../services/servicos';
import type { Cliente, FormaPagamento, VendaResumo } from '../../types/api';
import { exportarCsv } from '../../utils/exportar';
import { ImprimirCarne } from '../../components/ImpressaoCarne';
import { ReciboVenda } from '../../components/ReciboVenda';
import { formatarData, formatarDocumento, formatarMoeda, formatarNumero } from '../../utils/formatar';
import { FORMAS_PAGAMENTO } from '../compartilhado';

export default function HistoricoVendas() {
  const navegar = useNavigate();
  const { pode } = useAuth();
  const somenteProprias = !pode('vendas.consultar_todas');
  const [parametros, setParametros] = useSearchParams();
  const [periodo, setPeriodo] = useState<Periodo>(periodoDoMes);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [forma, setForma] = useState<FormaPagamento | ''>('');
  const [incluirEstornadas, setIncluirEstornadas] = useState(false);
  const idAberta = Number(parametros.get('venda')) || null;

  const [pagina, setPagina] = usePagina([periodo, cliente?.id, forma, incluirEstornadas]);

  const filtro = {
    ...periodo,
    idCliente: cliente?.id,
    formaPagamento: forma || undefined,
    incluirEstornadas: incluirEstornadas || undefined,
  };
  const lista = useRequisicao(
    () => vendaService.listar({ ...filtro, page: pagina, limit: 20 }),
    [periodo.inicio, periodo.fim, cliente?.id, forma, incluirEstornadas, pagina],
  );

  const abrir = (id: number | null) => setParametros(id ? { venda: String(id) } : {}, { replace: true });

  const exportar = async () => {
    const todas = await vendaService.listar({ ...filtro, page: 1, limit: 100 });
    exportarCsv(
      `vendas-${periodo.inicio}-a-${periodo.fim}`,
      [
        { titulo: 'Data', valor: (v: VendaResumo) => formatarData(v.data) },
        { titulo: 'Hora', valor: (v) => v.hora },
        { titulo: 'Controle', valor: (v) => v.controle },
        { titulo: 'Cliente', valor: (v) => v.cliente?.nome ?? 'Não identificado' },
        { titulo: 'Pagamento', valor: (v) => v.formasPagamento.join(' + ') },
        { titulo: 'Desconto', valor: (v) => v.desconto },
        { titulo: 'Total', valor: (v) => v.total },
        { titulo: 'Situação', valor: (v) => (v.estornada ? 'Estornada' : 'Concluída') },
      ],
      todas.data,
    );
  };

  return (
    <>
      <PageHeader
        titulo="Histórico de vendas"
        descricao={
          somenteProprias
            ? 'Suas vendas, por período, cliente e forma de pagamento.'
            : 'Consulte vendas por período, cliente e forma de pagamento.'
        }
        acoes={
          <>
            <Button variante="secundario" icone={<IoDownloadOutline />} onClick={exportar} disabled={!lista.dados?.data.length}>
              Exportar CSV
            </Button>
            {pode('vendas.registrar') ? (
              <Button icone={<IoAddCircleOutline />} onClick={() => navegar('/vendas/nova')}>
                Nova venda
              </Button>
            ) : null}
          </>
        }
      />
      <div className="pilha">
        <FiltroPeriodo periodo={periodo} aoMudar={setPeriodo} />
        <Painel semEspaco>
          <div className="barra-ferramentas">
            {cliente ? (
              <span className="filtro-ativo">
                {cliente.nome}
                <button type="button" className="btn btn-fantasma btn-sm" onClick={() => setCliente(null)}>
                  Limpar
                </button>
              </span>
            ) : (
              <SeletorBusca<Cliente>
                rotulo="Filtrar por cliente"
                buscar={async (termo) => (await clienteService.listar({ busca: termo, limit: 8 })).data}
                chave={(c) => c.id}
                renderizar={(c) => (
                  <div className="celula-principal">
                    <strong>{c.nome}</strong>
                    <span className="num">{formatarDocumento(c.cpf)}</span>
                  </div>
                )}
                aoSelecionar={setCliente}
              />
            )}
            <label className="sr-only" htmlFor="filtro-forma">
              Forma de pagamento
            </label>
            <select id="filtro-forma" className="entrada" value={forma} onChange={(e) => setForma(e.target.value as FormaPagamento | '')}>
              <option value="">Todas as formas</option>
              {FORMAS_PAGAMENTO.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.rotulo}
                </option>
              ))}
            </select>
            <label className="caixa-selecao">
              <input type="checkbox" checked={incluirEstornadas} onChange={(e) => setIncluirEstornadas(e.target.checked)} />
              Incluir estornadas
            </label>
          </div>
          <DataTable<VendaResumo>
            rotulo="Vendas"
            carregando={lista.carregando}
            erro={lista.erro}
            aoTentarNovamente={lista.recarregar}
            linhas={lista.dados?.data}
            chaveLinha={(v) => v.id}
            aoClicarLinha={(v) => abrir(v.id)}
            vazio={{ titulo: 'Nenhuma venda com esses filtros', descricao: 'Ajuste o período ou limpe os filtros.' }}
            colunas={[
              {
                chave: 'data',
                titulo: 'Data',
                render: (v) => (
                  <div className="celula-principal">
                    <strong className="num">{formatarData(v.data)}</strong>
                    <span className="num">{v.hora}</span>
                  </div>
                ),
              },
              { chave: 'cliente', titulo: 'Cliente', render: (v) => v.cliente?.nome ?? <span className="muted">Não identificado</span> },
              { chave: 'formas', titulo: 'Pagamento', ocultarNoCelular: true, render: (v) => v.formasPagamento.join(' + ') || '—' },
              { chave: 'vendedor', titulo: 'Vendedor', ocultarNoCelular: true, render: (v) => v.vendedor?.login ?? '—' },
              {
                chave: 'situacao',
                titulo: 'Situação',
                ocultarNoCelular: true,
                render: (v) => (v.estornada ? <Badge tom="perigo">Estornada</Badge> : <Badge tom="sucesso">Concluída</Badge>),
              },
              {
                chave: 'total',
                titulo: 'Total',
                alinhar: 'direita',
                render: (v) => <span className={v.estornada ? 'muted riscado' : undefined}>{formatarMoeda(v.total)}</span>,
              },
            ]}
          />
          <Pagination meta={lista.dados?.meta} aoMudar={setPagina} />
        </Painel>
      </div>

      {idAberta ? (
        <DetalheVenda
          id={idAberta}
          aoFechar={() => abrir(null)}
          aoEstornar={() => {
            lista.recarregar();
          }}
        />
      ) : null}
    </>
  );
}

function DetalheVenda({ id, aoFechar, aoEstornar }: { id: number; aoFechar: () => void; aoEstornar: () => void }) {
  const { pode } = useAuth();
  const { confirmar, notificar } = useFeedback();
  const venda = useRequisicao(() => vendaService.obter(id), [id]);
  const v = venda.dados;
  const [impressao, setImpressao] = useState<'recibo' | 'carne' | null>(null);

  const estornar = useAcao(async () => {
    if (!v) return;
    const sim = await confirmar({
      titulo: 'Estornar esta venda?',
      mensagem:
        'A venda é cancelada, os produtos voltam ao estoque e os lançamentos financeiros são estornados. Vendas com parcela de carnê já paga não podem ser estornadas.',
      confirmar: 'Estornar venda',
      perigo: true,
    });
    if (!sim) return;
    try {
      await vendaService.estornar(v.id);
      notificar('Venda estornada e estoque devolvido.');
      venda.recarregar();
      aoEstornar();
    } catch (erro) {
      notificar(mensagemErro(erro), 'erro');
    }
  });

  return (
    <Modal
      aberto
      titulo={v ? `Venda de ${formatarData(v.data)} às ${v.hora?.slice(0, 5) ?? ''}` : 'Venda'}
      descricao={v ? `Controle ${v.controle}` : undefined}
      aoFechar={aoFechar}
      tamanho="lg"
      rodape={
        v ? (
          <>
            {pode('vendas.estornar') && !v.estornada ? (
              <Button variante="fantasma" icone={<IoArrowUndoOutline />} onClick={() => void estornar.executar()} carregando={estornar.executando}>
                Estornar venda
              </Button>
            ) : null}
            {v.parcelasCarne.length ? (
              <Button variante="secundario" icone={<IoDocumentTextOutline />} onClick={() => setImpressao('carne')}>
                Reimprimir carnê
              </Button>
            ) : null}
            <Button variante="secundario" icone={<IoPrintOutline />} onClick={() => setImpressao('recibo')}>
              Imprimir recibo
            </Button>
          </>
        ) : undefined
      }
    >
      {venda.erro ? (
        <EstadoErro mensagem={venda.erro} aoTentarNovamente={venda.recarregar} />
      ) : !v ? (
        <div className="pilha">
          <Skeleton altura={60} />
          <Skeleton altura={120} />
        </div>
      ) : (
        <div className="pilha area-impressao">
          {v.estornada ? <Badge tom="perigo">Estornada em {formatarData(v.dataEstorno)}</Badge> : null}
          <Detalhes
            itens={[
              { rotulo: 'Cliente', valor: v.cliente?.nome ?? 'Não identificado' },
              { rotulo: 'Vendedor', valor: v.vendedor?.login },
              { rotulo: 'Terminal', valor: v.terminal },
              { rotulo: 'Total', valor: <strong>{formatarMoeda(v.total)}</strong> },
              { rotulo: 'Desconto', valor: formatarMoeda(v.desconto) },
              { rotulo: 'Pagamento', valor: v.formasPagamento.join(' + ') || '—' },
            ]}
          />
          <h3>Produtos vendidos</h3>
          <DataTable
            rotulo="Produtos vendidos"
            linhas={v.itens}
            chaveLinha={(i) => i.id}
            vazio={{ titulo: 'Sem itens' }}
            colunas={[
              { chave: 'produto', titulo: 'Produto', render: (i) => i.produto },
              { chave: 'qtd', titulo: 'Qtd.', alinhar: 'direita', render: (i) => formatarNumero(i.quantidade) },
              { chave: 'unit', titulo: 'Unitário', alinhar: 'direita', render: (i) => formatarMoeda(i.valorUnitario) },
              { chave: 'total', titulo: 'Total', alinhar: 'direita', render: (i) => formatarMoeda(i.valorTotal) },
            ]}
            rodape={
              <tr>
                <td colSpan={3}>Subtotal dos itens</td>
                <td className="alinhar-direita">{formatarMoeda(v.subtotalItens)}</td>
              </tr>
            }
          />
          {v.itensTroca.length ? (
            <>
              <h3>Itens devolvidos na troca</h3>
              <DataTable
                rotulo="Itens devolvidos"
                linhas={v.itensTroca}
                chaveLinha={(i) => i.id}
                colunas={[
                  { chave: 'produto', titulo: 'Produto', render: (i) => i.produto },
                  { chave: 'qtd', titulo: 'Qtd.', alinhar: 'direita', render: (i) => formatarNumero(i.quantidade) },
                  { chave: 'total', titulo: 'Crédito', alinhar: 'direita', render: (i) => formatarMoeda(i.valorTotal) },
                ]}
              />
            </>
          ) : null}
          {v.parcelasCarne.length ? (
            <>
              <h3>Parcelas do carnê</h3>
              <DataTable
                rotulo="Parcelas do carnê"
                linhas={v.parcelasCarne}
                chaveLinha={(p) => p.parcela}
                colunas={[
                  { chave: 'parcela', titulo: 'Parcela', render: (p) => <span className="num">{p.parcela}/{v.parcelasCarne.length}</span> },
                  { chave: 'codigo', titulo: 'Código', ocultarNoCelular: true, render: (p) => <span className="num">{p.codigo}</span> },
                  { chave: 'venc', titulo: 'Vencimento', render: (p) => <span className="num">{formatarData(p.vencimento)}</span> },
                  {
                    chave: 'sit',
                    titulo: 'Situação',
                    render: (p) =>
                      p.situacao === 'PAGA' ? (
                        <Badge tom="sucesso">Paga em {formatarData(p.dataPagamento)}</Badge>
                      ) : p.situacao === 'ESTORNADA' ? (
                        <Badge tom="neutro">Estornada</Badge>
                      ) : (
                        <Badge tom="aviso">Aberta</Badge>
                      ),
                  },
                  { chave: 'valor', titulo: 'Valor', alinhar: 'direita', render: (p) => formatarMoeda(p.valor) },
                ]}
              />
            </>
          ) : null}
        </div>
      )}
      {v && impressao === 'recibo' ? <ReciboVenda venda={v} aoFechar={() => setImpressao(null)} /> : null}
      {v && impressao === 'carne' ? <ImprimirCarne controle={v.controle} aoFechar={() => setImpressao(null)} /> : null}
    </Modal>
  );
}
