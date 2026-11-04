import { useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { IoDownloadOutline, IoPrintOutline } from 'react-icons/io5';
import { BarraSegmentada, GraficoColunas, GraficoRanking } from '../../components/charts/Graficos';
import { BadgeEstoque } from '../../components/Produto';
import { Button } from '../../components/ui/Button';
import { DataTable, type Coluna } from '../../components/ui/DataTable';
import { Badge, EstadoErro, EstadoVazio } from '../../components/ui/Estados';
import { FiltroPeriodo, type Periodo } from '../../components/ui/FiltroPeriodo';
import { periodoDoMes } from '../../utils/periodo';
import { Abas, Indicador, PageHeader, Painel } from '../../components/ui/Layout';
import { Pagination } from '../../components/ui/Pagination';
import { Skeleton } from '../../components/ui/Spinner';
import { useFeedback } from '../../contexts/FeedbackContext';
import { useRequisicao } from '../../hooks/useRequisicao';
import { usePagina } from '../../hooks/useEstadoReiniciado';
import { mensagemErro } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { relatorioService } from '../../services/servicos';
import type { Meta, Paginado } from '../../types/api';
import { exportarCsv, imprimir, type ColunaExportacao } from '../../utils/exportar';
import {
  formatarData,
  formatarInteiro,
  formatarMes,
  formatarMoeda,
  formatarMoedaCompacta,
  formatarNumero,
  formatarTelefone,
  formatarVariacao,
} from '../../utils/formatar';
import { BadgeMovimentacao } from '../../components/BadgeMovimentacao';
import { CORES_FORMAS, ROTULOS_FORMAS, ROTULOS_MOVIMENTACAO } from '../compartilhado';

const ABAS = [
  { id: 'vendas', titulo: 'Vendas', permissao: 'relatorios.vendas' },
  { id: 'faturamento', titulo: 'Faturamento', permissao: 'relatorios.vendas' },
  { id: 'desempenho', titulo: 'Desempenho', permissao: 'relatorios.vendas' },
  { id: 'produtos', titulo: 'Mais vendidos', permissao: 'relatorios.vendas' },
  { id: 'clientes', titulo: 'Por cliente', permissao: 'relatorios.vendas' },
  { id: 'debito', titulo: 'Clientes em débito', permissao: 'relatorios.vendas' },
  { id: 'baixas', titulo: 'Baixas de carnê', permissao: 'relatorios.vendas' },
  { id: 'estoque', titulo: 'Estoque baixo', permissao: 'relatorios.estoque' },
  { id: 'mercadorias', titulo: 'Mercadorias', permissao: 'relatorios.estoque' },
  { id: 'movimentacoes', titulo: 'Movimentações', permissao: 'relatorios.estoque' },
] as const;
type IdAba = (typeof ABAS)[number]['id'];

async function todasAsPaginas<T>(buscar: (pagina: number) => Promise<Paginado<T>>): Promise<T[]> {
  const primeira = await buscar(1);
  const resto = await Promise.all(
    Array.from({ length: Math.min(primeira.meta.totalPages, 50) - 1 }, (_, i) => buscar(i + 2)),
  );
  return [primeira, ...resto].flatMap((pagina) => pagina.data);
}

export default function Relatorios() {
  const [parametros, setParametros] = useSearchParams();
  const { pode } = useAuth();
  const abas = ABAS.filter((a) => pode(a.permissao));
  const aba = (abas.some((a) => a.id === parametros.get('aba')) ? parametros.get('aba') : (abas[0]?.id ?? 'vendas')) as IdAba;
  const [periodo, setPeriodo] = useState<Periodo>(periodoDoMes);
  const usaPeriodo = !['estoque', 'debito'].includes(aba);

  return (
    <>
      <PageHeader
        titulo="Relatórios"
        descricao="Números calculados pela API com as mesmas regras do sistema. Exporte em CSV (Excel) ou imprima/salve em PDF."
        acoes={
          <Button variante="secundario" icone={<IoPrintOutline />} onClick={imprimir}>
            Imprimir / PDF
          </Button>
        }
      />
      <Abas rotulo="Relatórios" abas={abas.map(({ id, titulo }) => ({ id, titulo }))} ativa={aba} aoMudar={(id) => setParametros({ aba: id }, { replace: true })} />
      <div className="pilha">
        {usaPeriodo ? <FiltroPeriodo periodo={periodo} aoMudar={setPeriodo} /> : null}
        <p className="so-impressao pequeno">
          {ABAS.find((a) => a.id === aba)?.titulo}
          {usaPeriodo ? ` · ${formatarData(periodo.inicio)} a ${formatarData(periodo.fim)}` : ''}
        </p>
        {aba === 'vendas' ? <RelVendas periodo={periodo} /> : null}
        {aba === 'faturamento' ? <RelFaturamento periodo={periodo} /> : null}
        {aba === 'desempenho' ? <RelDesempenho periodo={periodo} /> : null}
        {aba === 'produtos' ? <RelMaisVendidos periodo={periodo} /> : null}
        {aba === 'clientes' ? <RelPorCliente periodo={periodo} /> : null}
        {aba === 'debito' ? <RelDebito /> : null}
        {aba === 'baixas' ? <RelBaixas periodo={periodo} /> : null}
        {aba === 'estoque' ? <RelEstoqueBaixo /> : null}
        {aba === 'mercadorias' ? <RelMercadorias periodo={periodo} /> : null}
        {aba === 'movimentacoes' ? <RelMovimentacoes periodo={periodo} /> : null}
      </div>
    </>
  );
}

function TabelaRelatorio<T>({
  titulo,
  rotulo,
  estado,
  colunas,
  chaveLinha,
  aoMudarPagina,
  exportar,
  vazio,
  rodape,
}: {
  titulo?: string;
  rotulo: string;
  estado: { dados: { data: T[]; meta?: Meta } | null; carregando: boolean; erro: string | null; recarregar: () => void };
  colunas: Coluna<T>[];
  chaveLinha: (linha: T) => string | number;
  aoMudarPagina?: (pagina: number) => void;
  exportar?: () => Promise<void>;
  vazio: string;
  rodape?: ReactNode;
}) {
  const { notificar } = useFeedback();
  const [exportando, setExportando] = useState(false);
  const exportarComAviso = async () => {
    if (!exportar) return;
    setExportando(true);
    try {
      await exportar();
    } catch (erro) {
      notificar(mensagemErro(erro), 'erro');
    } finally {
      setExportando(false);
    }
  };
  return (
    <Painel
      titulo={titulo}
      semEspaco
      acoes={
        exportar ? (
          <Button variante="secundario" tamanho="sm" icone={<IoDownloadOutline />} onClick={exportarComAviso} carregando={exportando} disabled={!estado.dados?.data.length}>
            Exportar CSV
          </Button>
        ) : undefined
      }
    >
      <DataTable
        rotulo={rotulo}
        carregando={estado.carregando}
        erro={estado.erro}
        aoTentarNovamente={estado.recarregar}
        linhas={estado.dados?.data}
        chaveLinha={chaveLinha}
        colunas={colunas}
        vazio={{ titulo: vazio }}
        rodape={rodape}
      />
      {aoMudarPagina ? <Pagination meta={estado.dados?.meta} aoMudar={aoMudarPagina} /> : null}
    </Painel>
  );
}

function RelVendas({ periodo }: { periodo: Periodo }) {
  const [pagina, setPagina] = usePagina([periodo.inicio, periodo.fim]);
  const estado = useRequisicao(() => relatorioService.vendasPeriodo({ ...periodo, page: pagina, limit: 25 }), [periodo.inicio, periodo.fim, pagina]);
  const r = estado.dados?.resumo;
  const colunasCsv: ColunaExportacao<NonNullable<typeof estado.dados>['data'][number]>[] = [
    { titulo: 'Data', valor: (v) => formatarData(v.data) },
    { titulo: 'Hora', valor: (v) => v.hora },
    { titulo: 'Cliente', valor: (v) => v.cliente?.nome ?? 'Não identificado' },
    { titulo: 'Pagamento', valor: (v) => v.formasPagamento.join(' + ') },
    { titulo: 'Desconto', valor: (v) => v.desconto },
    { titulo: 'Total', valor: (v) => v.total },
  ];
  return (
    <>
      <div className="indicadores">
        <Indicador rotulo="Faturamento" carregando={!r} valor={r ? formatarMoeda(r.faturamento) : '—'} />
        <Indicador rotulo="Vendas" carregando={!r} valor={r ? formatarInteiro(r.quantidadeVendas) : '—'} />
        <Indicador rotulo="Ticket médio" carregando={!r} valor={r && r.quantidadeVendas ? formatarMoeda(r.faturamento / r.quantidadeVendas) : '—'} />
        <Indicador rotulo="Descontos" carregando={!r} valor={r ? formatarMoeda(r.descontos) : '—'} />
      </div>
      <TabelaRelatorio
        titulo="Vendas do período"
        rotulo="Relatório de vendas"
        estado={estado}
        chaveLinha={(v) => v.id}
        aoMudarPagina={setPagina}
        vazio="Nenhuma venda no período"
        exportar={async () =>
          exportarCsv(`vendas-${periodo.inicio}-a-${periodo.fim}`, colunasCsv, await todasAsPaginas((p) => relatorioService.vendasPeriodo({ ...periodo, page: p, limit: 100 })))
        }
        colunas={[
          { chave: 'data', titulo: 'Data', render: (v) => <span className="num">{formatarData(v.data)} <span className="muted">{v.hora?.slice(0, 5)}</span></span> },
          { chave: 'cliente', titulo: 'Cliente', render: (v) => v.cliente?.nome ?? <span className="muted">Não identificado</span> },
          { chave: 'pag', titulo: 'Pagamento', ocultarNoCelular: true, render: (v) => v.formasPagamento.join(' + ') || '—' },
          { chave: 'desc', titulo: 'Desconto', alinhar: 'direita', ocultarNoCelular: true, render: (v) => formatarMoeda(v.desconto) },
          { chave: 'total', titulo: 'Total', alinhar: 'direita', render: (v) => formatarMoeda(v.total) },
        ]}
      />
    </>
  );
}

function RelFaturamento({ periodo }: { periodo: Periodo }) {
  const [agrupar, setAgrupar] = useState<'dia' | 'mes'>('dia');
  const estado = useRequisicao(() => relatorioService.faturamento({ ...periodo, agrupar }), [periodo.inicio, periodo.fim, agrupar]);
  const serie = estado.dados?.serie ?? [];
  const rotular = (p: string) => (agrupar === 'mes' ? formatarMes(p) : formatarData(p));
  return (
    <>
      <Painel
        titulo={`Faturamento por ${agrupar === 'mes' ? 'mês' : 'dia'}`}
        descricao={estado.dados ? `Total: ${formatarMoeda(estado.dados.total)}` : undefined}
        acoes={
          <div className="segmentado" role="group" aria-label="Agrupar por">
            {(['dia', 'mes'] as const).map((a) => (
              <button key={a} type="button" className={agrupar === a ? 'segmento segmento-ativo' : 'segmento'} aria-pressed={agrupar === a} onClick={() => setAgrupar(a)}>
                {a === 'dia' ? 'Dia' : 'Mês'}
              </button>
            ))}
          </div>
        }
      >
        {estado.erro ? (
          <EstadoErro mensagem={estado.erro} aoTentarNovamente={estado.recarregar} />
        ) : estado.carregando && !estado.dados ? (
          <Skeleton altura={240} />
        ) : serie.length ? (
          <GraficoColunas
            rotulo="Faturamento"
            formatar={formatarMoeda}
            formatarEixo={formatarMoedaCompacta}
            dados={serie.map((p) => ({
              rotulo: rotular(p.periodo),
              rotuloEixo: agrupar === 'mes' ? formatarMes(p.periodo) : formatarData(p.periodo).slice(0, 5),
              valor: p.faturamento,
              detalhe: `${formatarInteiro(p.quantidadeVendas)} venda(s)`,
            }))}
          />
        ) : (
          <EstadoVazio titulo="Nenhuma venda no período" />
        )}
      </Painel>
      <TabelaRelatorio
        rotulo="Faturamento por período"
        estado={{ ...estado, dados: estado.dados ? { data: serie } : null }}
        chaveLinha={(p) => p.periodo}
        vazio="Nenhuma venda no período"
        exportar={async () =>
          exportarCsv(
            `faturamento-${periodo.inicio}-a-${periodo.fim}`,
            [
              { titulo: agrupar === 'mes' ? 'Mês' : 'Dia', valor: (p) => rotular(p.periodo) },
              { titulo: 'Vendas', valor: (p) => p.quantidadeVendas },
              { titulo: 'Descontos', valor: (p) => p.descontos },
              { titulo: 'Faturamento', valor: (p) => p.faturamento },
            ],
            serie,
          )
        }
        colunas={[
          { chave: 'p', titulo: agrupar === 'mes' ? 'Mês' : 'Dia', render: (p) => <span className="num">{rotular(p.periodo)}</span> },
          { chave: 'q', titulo: 'Vendas', alinhar: 'direita', render: (p) => formatarInteiro(p.quantidadeVendas) },
          { chave: 'd', titulo: 'Descontos', alinhar: 'direita', ocultarNoCelular: true, render: (p) => formatarMoeda(p.descontos) },
          { chave: 'f', titulo: 'Faturamento', alinhar: 'direita', render: (p) => formatarMoeda(p.faturamento) },
        ]}
        rodape={
          estado.dados ? (
            <tr>
              <td>Total</td>
              <td className="alinhar-direita">{formatarInteiro(serie.reduce((s, p) => s + p.quantidadeVendas, 0))}</td>
              <td className="alinhar-direita ocultar-celular" />
              <td className="alinhar-direita">{formatarMoeda(estado.dados.total)}</td>
            </tr>
          ) : undefined
        }
      />
    </>
  );
}

function RelDesempenho({ periodo }: { periodo: Periodo }) {
  const painel = useRequisicao(() => relatorioService.dashboard(periodo), [periodo.inicio, periodo.fim]);
  const formas = useRequisicao(() => relatorioService.formasPagamento(periodo), [periodo.inicio, periodo.fim]);
  const d = painel.dados;
  if (painel.erro) return <Painel><EstadoErro mensagem={painel.erro} aoTentarNovamente={painel.recarregar} /></Painel>;
  const variacao = (valor: number | null | undefined) =>
    valor == null ? 'Sem base de comparação' : `${formatarVariacao(valor)} vs. ${formatarData(d?.comparativo.periodoAnterior.inicio)} – ${formatarData(d?.comparativo.periodoAnterior.fim)}`;
  return (
    <>
      <div className="indicadores">
        <Indicador
          rotulo="Faturamento"
          carregando={!d}
          valor={d ? formatarMoeda(d.faturamento) : '—'}
          nota={d ? variacao(d.comparativo.variacaoFaturamentoPercentual) : undefined}
          tom={d?.comparativo.variacaoFaturamentoPercentual != null ? (d.comparativo.variacaoFaturamentoPercentual >= 0 ? 'positivo' : 'negativo') : undefined}
        />
        <Indicador
          rotulo="Vendas"
          carregando={!d}
          valor={d ? formatarInteiro(d.quantidadeVendas) : '—'}
          nota={d ? variacao(d.comparativo.variacaoQuantidadePercentual) : undefined}
          tom={d?.comparativo.variacaoQuantidadePercentual != null ? (d.comparativo.variacaoQuantidadePercentual >= 0 ? 'positivo' : 'negativo') : undefined}
        />
        <Indicador rotulo="Ticket médio" carregando={!d} valor={d ? formatarMoeda(d.ticketMedio) : '—'} />
        <Indicador rotulo="Clientes que compraram" carregando={!d} valor={d ? formatarInteiro(d.clientesAtendidos) : '—'} />
      </div>
      <div className="grade-2">
        <Painel titulo="Formas de pagamento">
          {formas.dados ? (
            <BarraSegmentada
              rotulo="Formas de pagamento"
              formatar={formatarMoeda}
              partes={formas.dados.formas.map((f) => ({ nome: ROTULOS_FORMAS[f.forma], valor: f.valor, cor: CORES_FORMAS[f.forma] }))}
            />
          ) : formas.erro ? (
            <EstadoErro mensagem={formas.erro} aoTentarNovamente={formas.recarregar} />
          ) : (
            <Skeleton altura={160} />
          )}
        </Painel>
        <Painel titulo="Carnês e estoque">
          {d ? (
            <dl className="cupom-linhas sem-borda">
              <div><dt>Descontos concedidos</dt><dd className="num">{formatarMoeda(d.descontos)}</dd></div>
              <div><dt>Itens vendidos</dt><dd className="num">{formatarNumero(d.itensVendidos)}</dd></div>
              <div><dt>Recebido em carnês ({formatarInteiro(d.recebimentosCarne.quantidade)})</dt><dd className="num">{formatarMoeda(d.recebimentosCarne.total)}</dd></div>
              <div><dt>A receber em carnês ({formatarInteiro(d.carneEmAberto.parcelas)} parcelas)</dt><dd className="num">{formatarMoeda(d.carneEmAberto.total)}</dd></div>
              <div><dt>Vencido ({formatarInteiro(d.carneEmAberto.parcelasVencidas)} parcelas)</dt><dd className="num nota-negativo">{formatarMoeda(d.carneEmAberto.totalVencido)}</dd></div>
              <div><dt>Produtos com estoque baixo</dt><dd className="num">{formatarInteiro(d.produtosEstoqueBaixo)}</dd></div>
            </dl>
          ) : (
            <Skeleton altura={160} />
          )}
        </Painel>
      </div>
    </>
  );
}

function RelMaisVendidos({ periodo }: { periodo: Periodo }) {
  const [ordenarPor, setOrdenarPor] = useState<'quantidade' | 'valor'>('quantidade');
  const estado = useRequisicao(() => relatorioService.maisVendidos({ ...periodo, limite: 30, ordenarPor }), [periodo.inicio, periodo.fim, ordenarPor]);
  const produtos = estado.dados?.produtos ?? [];
  return (
    <>
      <Painel
        titulo="Ranking de produtos"
        acoes={
          <div className="segmentado" role="group" aria-label="Ordenar por">
            {(['quantidade', 'valor'] as const).map((o) => (
              <button key={o} type="button" className={ordenarPor === o ? 'segmento segmento-ativo' : 'segmento'} aria-pressed={ordenarPor === o} onClick={() => setOrdenarPor(o)}>
                {o === 'quantidade' ? 'Quantidade' : 'Valor'}
              </button>
            ))}
          </div>
        }
      >
        {estado.erro ? (
          <EstadoErro mensagem={estado.erro} aoTentarNovamente={estado.recarregar} />
        ) : estado.carregando && !estado.dados ? (
          <Skeleton altura={240} />
        ) : produtos.length ? (
          <GraficoRanking
            rotulo="Produtos mais vendidos"
            formatar={ordenarPor === 'valor' ? formatarMoeda : (v) => `${formatarNumero(v)} un.`}
            dados={produtos.slice(0, 10).map((p) => ({ rotulo: p.produto, valor: ordenarPor === 'valor' ? p.valor : p.quantidade }))}
          />
        ) : (
          <EstadoVazio titulo="Nenhum produto vendido no período" />
        )}
      </Painel>
      <TabelaRelatorio
        rotulo="Produtos mais vendidos"
        estado={{ ...estado, dados: estado.dados ? { data: produtos } : null }}
        chaveLinha={(p) => p.idProduto}
        vazio="Nenhum produto vendido no período"
        exportar={async () =>
          exportarCsv(
            `mais-vendidos-${periodo.inicio}-a-${periodo.fim}`,
            [
              { titulo: 'Posição', valor: (p) => p.posicao },
              { titulo: 'Produto', valor: (p) => p.produto },
              { titulo: 'Código', valor: (p) => p.codigoBarras },
              { titulo: 'Quantidade', valor: (p) => p.quantidade },
              { titulo: 'Valor', valor: (p) => p.valor },
              { titulo: 'Vendas', valor: (p) => p.vendas },
            ],
            produtos,
          )
        }
        colunas={[
          { chave: 'pos', titulo: '#', render: (p) => <span className="num muted">{p.posicao}</span> },
          { chave: 'produto', titulo: 'Produto', render: (p) => p.produto },
          { chave: 'qtd', titulo: 'Quantidade', alinhar: 'direita', render: (p) => formatarNumero(p.quantidade) },
          { chave: 'vendas', titulo: 'Vendas', alinhar: 'direita', ocultarNoCelular: true, render: (p) => formatarInteiro(p.vendas) },
          { chave: 'valor', titulo: 'Valor', alinhar: 'direita', render: (p) => formatarMoeda(p.valor) },
        ]}
      />
    </>
  );
}

function RelPorCliente({ periodo }: { periodo: Periodo }) {
  const [incluir, setIncluir] = useState(false);
  const estado = useRequisicao(
    () => relatorioService.vendasPorCliente({ ...periodo, limite: 50, incluirNaoIdentificado: incluir || undefined }),
    [periodo.inicio, periodo.fim, incluir],
  );
  const clientes = estado.dados?.clientes ?? [];
  return (
    <>
      <label className="caixa-selecao nao-imprimir">
        <input type="checkbox" checked={incluir} onChange={(e) => setIncluir(e.target.checked)} />
        Incluir vendas sem cliente identificado
      </label>
      <TabelaRelatorio
        titulo="Clientes que mais compraram"
        rotulo="Vendas por cliente"
        estado={{ ...estado, dados: estado.dados ? { data: clientes } : null }}
        chaveLinha={(c) => c.idCliente}
        vazio="Nenhuma venda para clientes identificados no período"
        exportar={async () =>
          exportarCsv(
            `vendas-por-cliente-${periodo.inicio}-a-${periodo.fim}`,
            [
              { titulo: 'Posição', valor: (c) => c.posicao },
              { titulo: 'Cliente', valor: (c) => c.cliente },
              { titulo: 'Vendas', valor: (c) => c.quantidadeVendas },
              { titulo: 'Total', valor: (c) => c.total },
              { titulo: 'Ticket médio', valor: (c) => c.ticketMedio },
              { titulo: 'Última compra', valor: (c) => formatarData(c.ultimaCompra) },
            ],
            clientes,
          )
        }
        colunas={[
          { chave: 'pos', titulo: '#', render: (c) => <span className="num muted">{c.posicao}</span> },
          { chave: 'cliente', titulo: 'Cliente', render: (c) => c.cliente },
          { chave: 'q', titulo: 'Vendas', alinhar: 'direita', render: (c) => formatarInteiro(c.quantidadeVendas) },
          { chave: 'tm', titulo: 'Ticket médio', alinhar: 'direita', ocultarNoCelular: true, render: (c) => formatarMoeda(c.ticketMedio) },
          { chave: 'ult', titulo: 'Última compra', ocultarNoCelular: true, render: (c) => <span className="num">{formatarData(c.ultimaCompra)}</span> },
          { chave: 't', titulo: 'Total', alinhar: 'direita', render: (c) => formatarMoeda(c.total) },
        ]}
      />
    </>
  );
}

function RelDebito() {
  const [pagina, setPagina] = useState(1);
  const estado = useRequisicao(() => relatorioService.clientesDebito({ page: pagina, limit: 25 }), [pagina]);
  return (
    <>
      <div className="indicadores indicadores-1">
        <Indicador rotulo="Total em aberto nos carnês" carregando={!estado.dados} valor={estado.dados ? formatarMoeda(estado.dados.resumo.valorTotalEmAberto) : '—'} nota={estado.dados ? `${formatarInteiro(estado.dados.meta.total)} clientes` : undefined} />
      </div>
      <TabelaRelatorio
        titulo="Clientes com débito em carnê"
        rotulo="Clientes em débito"
        estado={estado}
        chaveLinha={(c) => c.idCliente}
        aoMudarPagina={setPagina}
        vazio="Nenhum cliente com parcela em aberto"
        exportar={async () =>
          exportarCsv(
            'clientes-em-debito',
            [
              { titulo: 'Cliente', valor: (c) => c.cliente },
              { titulo: 'Telefone', valor: (c) => c.celular ?? c.telefone },
              { titulo: 'Parcelas em aberto', valor: (c) => c.parcelasEmAberto },
              { titulo: 'Valor em aberto', valor: (c) => c.valorEmAberto },
              { titulo: 'Parcelas vencidas', valor: (c) => c.parcelasVencidas },
              { titulo: 'Valor vencido', valor: (c) => c.valorVencido },
              { titulo: 'Próximo vencimento', valor: (c) => formatarData(c.proximoVencimento) },
            ],
            await todasAsPaginas((p) => relatorioService.clientesDebito({ page: p, limit: 100 })),
          )
        }
        colunas={[
          { chave: 'cliente', titulo: 'Cliente', render: (c) => c.cliente },
          { chave: 'tel', titulo: 'Telefone', ocultarNoCelular: true, render: (c) => <span className="num">{formatarTelefone(c.celular ?? c.telefone)}</span> },
          { chave: 'venc', titulo: 'Próximo vencimento', ocultarNoCelular: true, render: (c) => <span className="num">{formatarData(c.proximoVencimento)}</span> },
          { chave: 'vencido', titulo: 'Vencido', alinhar: 'direita', render: (c) => (c.valorVencido > 0 ? <Badge tom="perigo">{formatarMoeda(c.valorVencido)}</Badge> : '—') },
          { chave: 'aberto', titulo: 'Em aberto', alinhar: 'direita', render: (c) => formatarMoeda(c.valorEmAberto) },
        ]}
      />
    </>
  );
}

function RelBaixas({ periodo }: { periodo: Periodo }) {
  const [pagina, setPagina] = usePagina([periodo.inicio, periodo.fim]);
  const estado = useRequisicao(() => relatorioService.baixasCarne({ ...periodo, page: pagina, limit: 25 }), [periodo.inicio, periodo.fim, pagina]);
  const r = estado.dados?.resumo;
  return (
    <>
      <div className="indicadores indicadores-2">
        <Indicador rotulo="Total recebido em carnês" carregando={!r} valor={r ? formatarMoeda(r.total) : '—'} />
        <Indicador rotulo="Parcelas recebidas" carregando={!r} valor={r ? formatarInteiro(r.quantidade) : '—'} />
      </div>
      <TabelaRelatorio
        titulo="Baixas de carnê"
        rotulo="Baixas de carnê"
        estado={estado}
        chaveLinha={(b) => b.id}
        aoMudarPagina={setPagina}
        vazio="Nenhuma parcela recebida no período"
        exportar={async () =>
          exportarCsv(
            `baixas-carne-${periodo.inicio}-a-${periodo.fim}`,
            [
              { titulo: 'Data', valor: (b) => formatarData(b.data) },
              { titulo: 'Cliente', valor: (b) => b.cliente },
              { titulo: 'Código', valor: (b) => b.codigo },
              { titulo: 'Parcela', valor: (b) => b.parcela },
              { titulo: 'Vencimento', valor: (b) => formatarData(b.vencimento) },
              { titulo: 'Juros', valor: (b) => b.juros },
              { titulo: 'Desconto', valor: (b) => b.desconto },
              { titulo: 'Valor pago', valor: (b) => b.valorPago },
            ],
            await todasAsPaginas((p) => relatorioService.baixasCarne({ ...periodo, page: p, limit: 100 })),
          )
        }
        colunas={[
          { chave: 'data', titulo: 'Data', render: (b) => <span className="num">{formatarData(b.data)}</span> },
          { chave: 'cliente', titulo: 'Cliente', render: (b) => b.cliente ?? '—' },
          { chave: 'cod', titulo: 'Código', ocultarNoCelular: true, render: (b) => <span className="num">{b.codigo}</span> },
          { chave: 'venc', titulo: 'Vencimento', ocultarNoCelular: true, render: (b) => <span className="num">{formatarData(b.vencimento)}</span> },
          { chave: 'pago', titulo: 'Valor pago', alinhar: 'direita', render: (b) => formatarMoeda(b.valorPago) },
        ]}
      />
    </>
  );
}

function RelEstoqueBaixo() {
  const [pagina, setPagina] = useState(1);
  const estado = useRequisicao(() => relatorioService.estoqueBaixo({ page: pagina, limit: 25 }), [pagina]);
  return (
    <TabelaRelatorio
      titulo="Produtos com menor quantidade em estoque"
      rotulo="Estoque baixo"
      estado={estado}
      chaveLinha={(p) => p.id}
      aoMudarPagina={setPagina}
      vazio="Nenhum produto com estoque baixo"
      exportar={async () =>
        exportarCsv(
          'estoque-baixo',
          [
            { titulo: 'Produto', valor: (p) => p.nome },
            { titulo: 'Código', valor: (p) => p.codigoBarras },
            { titulo: 'Fornecedor', valor: (p) => p.fornecedor?.nome },
            { titulo: 'Saldo', valor: (p) => p.quantidadeEstoque },
            { titulo: 'Mínimo', valor: (p) => p.estoqueMinimo },
          ],
          await todasAsPaginas((p) => relatorioService.estoqueBaixo({ page: p, limit: 100 })),
        )
      }
      colunas={[
        { chave: 'nome', titulo: 'Produto', render: (p) => p.nome },
        { chave: 'forn', titulo: 'Fornecedor', ocultarNoCelular: true, render: (p) => p.fornecedor?.nome ?? '—' },
        { chave: 'min', titulo: 'Mínimo', alinhar: 'direita', ocultarNoCelular: true, render: (p) => (p.estoqueMinimo ? formatarNumero(p.estoqueMinimo) : 'Limite padrão') },
        { chave: 'saldo', titulo: 'Saldo', alinhar: 'direita', render: (p) => <BadgeEstoque produto={{ ...p, estoqueMinimo: p.estoqueMinimo || Number.MAX_SAFE_INTEGER }} /> },
      ]}
    />
  );
}

function RelMercadorias({ periodo }: { periodo: Periodo }) {
  const [pagina, setPagina] = usePagina([periodo.inicio, periodo.fim]);
  const estado = useRequisicao(() => relatorioService.mercadorias({ ...periodo, page: pagina, limit: 25 }), [periodo.inicio, periodo.fim, pagina]);
  const r = estado.dados?.resumo;
  return (
    <>
      <div className="indicadores indicadores-2">
        <Indicador rotulo="Investimento em mercadorias" carregando={!r} valor={r ? formatarMoeda(r.investimento) : '—'} />
        <Indicador rotulo="Itens lançados" carregando={!r} valor={r ? formatarNumero(r.itens) : '—'} nota={r ? `${formatarInteiro(r.lancamentos)} lançamentos` : undefined} />
      </div>
      <TabelaRelatorio
        titulo="Mercadorias lançadas por nota"
        rotulo="Mercadorias"
        estado={estado}
        chaveLinha={(m) => m.id}
        aoMudarPagina={setPagina}
        vazio="Nenhuma nota lançada no período"
        exportar={async () =>
          exportarCsv(
            `mercadorias-${periodo.inicio}-a-${periodo.fim}`,
            [
              { titulo: 'Data', valor: (m) => formatarData(m.dataCadastro) },
              { titulo: 'Nota', valor: (m) => m.numeroNota },
              { titulo: 'Produto', valor: (m) => m.produto },
              { titulo: 'Fornecedor', valor: (m) => m.fornecedor },
              { titulo: 'Quantidade', valor: (m) => m.quantidade },
              { titulo: 'Valor de compra', valor: (m) => m.valorCompra },
              { titulo: 'Investimento', valor: (m) => m.investimento },
            ],
            await todasAsPaginas((p) => relatorioService.mercadorias({ ...periodo, page: p, limit: 100 })),
          )
        }
        colunas={[
          { chave: 'data', titulo: 'Data', render: (m) => <span className="num">{formatarData(m.dataCadastro)}</span> },
          { chave: 'nota', titulo: 'Nota', ocultarNoCelular: true, render: (m) => <span className="num">{m.numeroNota}</span> },
          { chave: 'produto', titulo: 'Produto', render: (m) => m.produto },
          { chave: 'qtd', titulo: 'Qtd.', alinhar: 'direita', render: (m) => formatarNumero(m.quantidade) },
          { chave: 'custo', titulo: 'Custo', alinhar: 'direita', ocultarNoCelular: true, render: (m) => formatarMoeda(m.valorCompra) },
          { chave: 'inv', titulo: 'Investimento', alinhar: 'direita', render: (m) => formatarMoeda(m.investimento) },
        ]}
      />
    </>
  );
}

function RelMovimentacoes({ periodo }: { periodo: Periodo }) {
  const [pagina, setPagina] = usePagina([periodo.inicio, periodo.fim]);
  const estado = useRequisicao(() => relatorioService.movimentacoes({ ...periodo, page: pagina, limit: 25 }), [periodo.inicio, periodo.fim, pagina]);
  return (
    <TabelaRelatorio
      titulo="Movimentações de estoque"
      rotulo="Movimentações de estoque"
      estado={estado}
      chaveLinha={(m) => `${m.origem}-${m.id}`}
      aoMudarPagina={setPagina}
      vazio="Nenhuma movimentação no período"
      exportar={async () =>
        exportarCsv(
          `movimentacoes-${periodo.inicio}-a-${periodo.fim}`,
          [
            { titulo: 'Data', valor: (m) => formatarData(m.data) },
            { titulo: 'Tipo', valor: (m) => ROTULOS_MOVIMENTACAO[m.tipo] },
            { titulo: 'Produto', valor: (m) => m.produto },
            { titulo: 'Quantidade', valor: (m) => m.quantidade },
            { titulo: 'Valor unitário', valor: (m) => m.valorUnitario },
            { titulo: 'Documento', valor: (m) => m.documento },
          ],
          await todasAsPaginas((p) => relatorioService.movimentacoes({ ...periodo, page: p, limit: 100 })),
        )
      }
      colunas={[
        { chave: 'data', titulo: 'Data', render: (m) => <span className="num">{formatarData(m.data)}</span> },
        { chave: 'tipo', titulo: 'Tipo', render: (m) => <BadgeMovimentacao tipo={m.tipo} /> },
        { chave: 'produto', titulo: 'Produto', render: (m) => m.produto },
        { chave: 'qtd', titulo: 'Quantidade', alinhar: 'direita', render: (m) => `${m.quantidade > 0 ? '+' : ''}${formatarNumero(m.quantidade)}` },
        { chave: 'doc', titulo: 'Documento', ocultarNoCelular: true, render: (m) => <span className="num muted">{m.documento}</span> },
      ]}
    />
  );
}
