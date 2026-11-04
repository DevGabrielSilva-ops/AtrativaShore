import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { IoAddCircleOutline, IoWarningOutline } from 'react-icons/io5';
import { BarraSegmentada, GraficoColunas, GraficoRanking } from '../../components/charts/Graficos';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { Badge, EstadoErro, EstadoVazio } from '../../components/ui/Estados';
import { FiltroPeriodo, type Periodo } from '../../components/ui/FiltroPeriodo';
import { periodoDoMes } from '../../utils/periodo';
import { Indicador, PageHeader, Painel } from '../../components/ui/Layout';
import { Skeleton } from '../../components/ui/Spinner';
import { useAuth } from '../../contexts/AuthContext';
import { useRequisicao } from '../../hooks/useRequisicao';
import { clienteService, produtoService, relatorioService, vendaService } from '../../services/servicos';
import type { VendaResumo } from '../../types/api';
import {
  formatarData,
  formatarInteiro,
  formatarMes,
  formatarMoeda,
  formatarMoedaCompacta,
  formatarNumero,
  formatarVariacao,
} from '../../utils/formatar';
import { CORES_FORMAS, ROTULOS_FORMAS } from '../compartilhado';

function diasEntre(periodo: Periodo): number {
  return Math.round((Date.parse(periodo.fim) - Date.parse(periodo.inicio)) / 86_400_000) + 1;
}

export default function Dashboard() {
  const { usuario } = useAuth();
  const navegar = useNavigate();
  const [periodo, setPeriodo] = useState<Periodo>(periodoDoMes);
  const agrupar = diasEntre(periodo) > 62 ? 'mes' : 'dia';

  const resumo = useRequisicao(() => relatorioService.dashboard(periodo), [periodo.inicio, periodo.fim]);
  const serie = useRequisicao(
    () => relatorioService.faturamento({ ...periodo, agrupar }),
    [periodo.inicio, periodo.fim, agrupar],
  );
  const maisVendidos = useRequisicao(
    () => relatorioService.maisVendidos({ ...periodo, limite: 6 }),
    [periodo.inicio, periodo.fim],
  );
  const recentes = useRequisicao(() => vendaService.listar({ limit: 6 }), []);
  const contagens = useRequisicao(
    async () => {
      const [clientes, produtos] = await Promise.all([
        clienteService.listar({ limit: 1 }),
        produtoService.listar({ limit: 1 }),
      ]);
      return { clientes: clientes.meta.total, produtos: produtos.meta.total };
    },
    [],
  );
  const estoqueBaixo = useRequisicao(() => produtoService.estoqueBaixo({ limit: 6 }), []);

  const d = resumo.dados;
  const variacao = d?.comparativo.variacaoFaturamentoPercentual ?? null;

  return (
    <div className="pilha dashboard">
      <PageHeader
        titulo={`Olá, ${usuario?.nome.split(' ')[0] ?? ''}`}
        descricao="Resumo das vendas, carnês e estoque da loja."
        acoes={
          <Button icone={<IoAddCircleOutline />} onClick={() => navegar('/vendas/nova')}>
            Nova venda
          </Button>
        }
      />

      <FiltroPeriodo periodo={periodo} aoMudar={setPeriodo} />

      {resumo.erro ? (
        <Painel>
          <EstadoErro mensagem={resumo.erro} aoTentarNovamente={resumo.recarregar} />
        </Painel>
      ) : (
        <div className="dash-topo">
          <section className="dash-hero painel" aria-labelledby="dash-faturamento">
            <p className="indicador-rotulo" id="dash-faturamento">
              Faturamento no período
            </p>
            {resumo.carregando || !d ? (
              <Skeleton largura="70%" altura={52} />
            ) : (
              <p className="dash-hero-valor">{formatarMoeda(d.faturamento)}</p>
            )}
            {d && !resumo.carregando ? (
              <p className="pequeno muted">
                {variacao === null
                  ? 'Sem vendas no período anterior para comparar.'
                  : (
                      <>
                        <span className={variacao >= 0 ? 'nota-positivo' : 'nota-negativo'}>
                          {formatarVariacao(variacao)}
                        </span>{' '}
                        em relação a {formatarData(d.comparativo.periodoAnterior.inicio)} –{' '}
                        {formatarData(d.comparativo.periodoAnterior.fim)} ({formatarMoeda(d.comparativo.faturamentoAnterior)})
                      </>
                    )}
              </p>
            ) : null}
            <div className="dash-hero-rodape">
              <div>
                <span className="muted pequeno">Descontos</span>
                <strong className="num">{d ? formatarMoeda(d.descontos) : '—'}</strong>
              </div>
              <div>
                <span className="muted pequeno">Itens vendidos</span>
                <strong className="num">{d ? formatarNumero(d.itensVendidos) : '—'}</strong>
              </div>
              <div>
                <span className="muted pequeno">Recebido em carnês</span>
                <strong className="num">{d ? formatarMoeda(d.recebimentosCarne.total) : '—'}</strong>
              </div>
            </div>
          </section>

          <div className="indicadores dash-indicadores">
            <Indicador
              rotulo="Vendas"
              carregando={resumo.carregando}
              valor={d ? formatarInteiro(d.quantidadeVendas) : '—'}
              nota={
                d?.comparativo.variacaoQuantidadePercentual != null
                  ? `${formatarVariacao(d.comparativo.variacaoQuantidadePercentual)} vs. período anterior`
                  : undefined
              }
            />
            <Indicador rotulo="Ticket médio" carregando={resumo.carregando} valor={d ? formatarMoeda(d.ticketMedio) : '—'} />
            <Indicador
              rotulo="Clientes cadastrados"
              carregando={contagens.carregando}
              valor={contagens.dados ? formatarInteiro(contagens.dados.clientes) : '—'}
              nota={d ? `${formatarInteiro(d.clientesAtendidos)} compraram no período` : undefined}
            />
            <Indicador
              rotulo="Produtos cadastrados"
              carregando={contagens.carregando}
              valor={contagens.dados ? formatarInteiro(contagens.dados.produtos) : '—'}
              nota={d && d.produtosEstoqueBaixo > 0 ? `${formatarInteiro(d.produtosEstoqueBaixo)} com estoque baixo` : undefined}
              tom={d && d.produtosEstoqueBaixo > 0 ? 'alerta' : undefined}
            />
          </div>
        </div>
      )}

      <div className="dash-grade">
        <Painel
          titulo={agrupar === 'mes' ? 'Faturamento por mês' : 'Faturamento por dia'}
          descricao="Vendas não estornadas, incluindo as feitas no carnê"
          className="dash-grafico"
        >
          {serie.erro ? (
            <EstadoErro mensagem={serie.erro} aoTentarNovamente={serie.recarregar} />
          ) : serie.carregando && !serie.dados ? (
            <Skeleton altura={240} />
          ) : serie.dados && serie.dados.serie.length > 0 ? (
            <GraficoColunas
              rotulo="Faturamento no período"
              formatar={formatarMoeda}
              formatarEixo={formatarMoedaCompacta}
              dados={serie.dados.serie.map((ponto) => ({
                rotulo: agrupar === 'mes' ? formatarMes(ponto.periodo) : formatarData(ponto.periodo),
                rotuloEixo: agrupar === 'mes' ? formatarMes(ponto.periodo) : formatarData(ponto.periodo).slice(0, 5),
                valor: ponto.faturamento,
                detalhe: `${formatarInteiro(ponto.quantidadeVendas)} venda(s)`,
              }))}
            />
          ) : (
            <EstadoVazio titulo="Nenhuma venda no período" descricao="Escolha outro período ou registre uma venda." />
          )}
        </Painel>

        <Painel titulo="Formas de pagamento" descricao="Valores recebidos nas vendas do período">
          {resumo.carregando || !d ? (
            <Skeleton altura={160} />
          ) : (
            <BarraSegmentada
              rotulo="Formas de pagamento"
              formatar={formatarMoeda}
              partes={(['dinheiro', 'pix', 'cartao', 'carne', 'outros'] as const).map((forma) => ({
                nome: ROTULOS_FORMAS[forma],
                valor: d.formasPagamento[forma],
                cor: CORES_FORMAS[forma],
              }))}
            />
          )}
          {d && d.carneEmAberto.parcelas > 0 ? (
            <Link to="/carnes" className="dash-carne">
              <span>
                <strong className="num">{formatarMoeda(d.carneEmAberto.total)}</strong> a receber em{' '}
                {formatarInteiro(d.carneEmAberto.parcelas)} parcelas de carnê
              </span>
              {d.carneEmAberto.parcelasVencidas > 0 ? (
                <Badge tom="perigo">
                  <IoWarningOutline aria-hidden /> {formatarInteiro(d.carneEmAberto.parcelasVencidas)} vencidas
                </Badge>
              ) : null}
            </Link>
          ) : null}
        </Painel>

        <Painel
          titulo="Repor estoque"
          descricao="Saldo no mínimo cadastrado ou abaixo do limite"
          acoes={
            <Link to="/estoque?filtro=baixo" className="link-pequeno">
              Ver todos
            </Link>
          }
          semEspaco
        >
          <DataTable
            rotulo="Produtos com estoque baixo"
            carregando={estoqueBaixo.carregando}
            erro={estoqueBaixo.erro}
            aoTentarNovamente={estoqueBaixo.recarregar}
            linhas={estoqueBaixo.dados?.data}
            chaveLinha={(p) => p.id}
            linhasCarregando={4}
            vazio={{ titulo: 'Nenhum produto precisando de reposição' }}
            colunas={[
              { chave: 'nome', titulo: 'Produto', render: (p) => p.nome },
              {
                chave: 'saldo',
                titulo: 'Saldo',
                alinhar: 'direita',
                render: (p) => (
                  <Badge tom={(p.quantidadeEstoque ?? 0) <= 0 ? 'perigo' : 'aviso'}>{formatarNumero(p.quantidadeEstoque)}</Badge>
                ),
              },
            ]}
          />
        </Painel>
        <Painel
          titulo="Produtos mais vendidos"
          descricao="Por quantidade no período"
          acoes={
            <Link to="/relatorios?aba=produtos" className="link-pequeno">
              Ver relatório
            </Link>
          }
        >
          {maisVendidos.erro ? (
            <EstadoErro mensagem={maisVendidos.erro} aoTentarNovamente={maisVendidos.recarregar} />
          ) : maisVendidos.carregando && !maisVendidos.dados ? (
            <Skeleton altura={180} />
          ) : maisVendidos.dados?.produtos.length ? (
            <GraficoRanking
              rotulo="Produtos mais vendidos"
              formatar={(valor) => `${formatarNumero(valor)} un.`}
              dados={maisVendidos.dados.produtos.map((produto) => ({
                rotulo: produto.produto,
                valor: produto.quantidade,
                detalhe: formatarMoeda(produto.valor),
              }))}
            />
          ) : (
            <EstadoVazio titulo="Nenhum produto vendido no período" />
          )}
        </Painel>

      </div>

      <Painel
        titulo="Vendas recentes"
        acoes={
          <Link to="/vendas" className="link-pequeno">
            Ver histórico
          </Link>
        }
        semEspaco
      >
        <DataTable<VendaResumo>
          rotulo="Vendas recentes"
          carregando={recentes.carregando}
          erro={recentes.erro}
          aoTentarNovamente={recentes.recarregar}
          linhas={recentes.dados?.data}
          chaveLinha={(v) => v.id}
          aoClicarLinha={(v) => navegar(`/vendas?venda=${v.id}`)}
          linhasCarregando={4}
          vazio={{ titulo: 'Nenhuma venda registrada ainda' }}
          colunas={[
            {
              chave: 'data',
              titulo: 'Data',
              render: (v) => (
                <span className="num">
                  {formatarData(v.data)} <span className="muted">{v.hora?.slice(0, 5)}</span>
                </span>
              ),
            },
            { chave: 'cliente', titulo: 'Cliente', render: (v) => v.cliente?.nome ?? <span className="muted">Não identificado</span> },
            { chave: 'formas', titulo: 'Pagamento', ocultarNoCelular: true, render: (v) => v.formasPagamento.join(' + ') || '—' },
            { chave: 'total', titulo: 'Total', alinhar: 'direita', render: (v) => formatarMoeda(v.total) },
          ]}
        />
      </Painel>
    </div>
  );
}
