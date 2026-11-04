import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ConfiguracaoService } from '../config/configuracao.service.js';
import { MODO_VENDA, NAO, ORIGEM_FINANCEIRO, SIM } from '../common/constantes/legado.js';
import { offset, paginado, type PaginacaoDto } from '../common/dto/paginacao.dto.js';
import type { PeriodoDto, PeriodoPaginadoDto } from '../common/dto/periodo.dto.js';
import { PREFIXO_NOTA_AJUSTE } from '../common/utils/codigos.js';
import { adicionarDias, dataIsoValida, dataNoFuso, diferencaEmDias } from '../common/utils/datas.js';
import { arredondarCasas, multiplicar, paraCentavos, paraReais, somar } from '../common/utils/dinheiro.js';
import { numero, numeroOuNulo } from '../common/utils/transformadores.js';
import { ProdutosService } from '../produtos/produtos.service.js';
import { COLUNA_FORMA } from '../vendas/vendas.consultas.js';
import { VendasService } from '../vendas/vendas.service.js';
import type {
  FaturamentoDto,
  MaisVendidosDto,
  VendasPeriodoDto,
  VendasPorClienteDto,
} from './dto/relatorios.dto.js';

export interface Periodo {
  inicio: string;
  fim: string;
}

/** Venda válida: não estornada, com controle e dentro do período. */
const VENDA_VALIDA = 'v.estornado = 0 AND v.controle IS NOT NULL AND v.data_venda BETWEEN ? AND ?';

function variacao(atual: number, anterior: number): number | null {
  if (anterior === 0) return null;
  return arredondarCasas(((atual - anterior) / anterior) * 100, 2);
}

/**
 * Relatórios e indicadores do dashboard, sempre por SQL agregado no banco
 * (sem carregar registros para somar em memória).
 *
 * Definições:
 *  - faturamento = soma de mv_vendas.vr_total das vendas não estornadas,
 *    incluindo as vendas no carnê (regime de competência);
 *  - recebimentos de carnê são informados à parte (não somam no faturamento);
 *  - a empresa é única no banco, então todo relatório é da empresa configurada.
 */
@Injectable()
export class RelatoriosService {
  constructor(
    private readonly fonte: DataSource,
    private readonly config: ConfiguracaoService,
    private readonly vendas: VendasService,
    private readonly produtos: ProdutosService,
  ) {}

  diaAtual(): Periodo {
    const hoje = dataNoFuso(new Date(), this.config.fusoHorario);
    return { inicio: hoje, fim: hoje };
  }

  /** Período informado ou, por padrão, do dia 1º do mês corrente até hoje. */
  resolverPeriodo(periodo: PeriodoDto): Periodo {
    const hoje = dataNoFuso(new Date(), this.config.fusoHorario);
    const inicio = periodo.inicio ?? `${hoje.slice(0, 8)}01`;
    const fim = periodo.fim ?? hoje;
    if (!dataIsoValida(inicio) || !dataIsoValida(fim)) throw new BadRequestException('Período com data inválida');
    if (inicio > fim) throw new BadRequestException('A data inicial deve ser anterior ou igual à final');
    return { inicio, fim };
  }

  async dashboard(filtro: PeriodoDto) {
    const periodo = this.resolverPeriodo(filtro);
    const dias = diferencaEmDias(periodo.inicio, periodo.fim) + 1;
    const anterior: Periodo = {
      inicio: adicionarDias(periodo.inicio, -dias),
      fim: adicionarDias(periodo.inicio, -1),
    };
    const hoje = dataNoFuso(new Date(), this.config.fusoHorario);

    const [[atual], [passado], [itens], [recebimentos], [carne], estoqueBaixo] = await Promise.all([
      this.agregadoVendas(periodo),
      this.agregadoVendas(anterior),
      this.fonte.query(
        `SELECT SUM(m.quant) AS quantidade FROM mv_vendas_movimento m
          WHERE m.estornado = 0 AND m.modo_venda = ? AND m.data_venda BETWEEN ? AND ?`,
        [MODO_VENDA.PRODUTO, periodo.inicio, periodo.fim],
      ) as Promise<Array<Record<string, unknown>>>,
      this.fonte.query(
        `SELECT COUNT(*) AS quantidade, SUM(m.vr_total) AS total FROM mv_vendas_movimento m
          WHERE m.estornado = 0 AND m.modo_venda = ? AND m.data_venda BETWEEN ? AND ?`,
        [MODO_VENDA.RECEBIMENTO_CARNE, periodo.inicio, periodo.fim],
      ) as Promise<Array<Record<string, unknown>>>,
      this.fonte.query(
        `SELECT COUNT(*) AS parcelas, SUM(vr_parcela) AS total,
                SUM(data_vencimento < ?) AS parcelas_vencidas,
                SUM(CASE WHEN data_vencimento < ? THEN vr_parcela ELSE 0 END) AS total_vencido
           FROM mv_financeiro WHERE origem_lancamento = ? AND efetuado = ? AND estornado = 0`,
        [hoje, hoje, ORIGEM_FINANCEIRO.CARNE, NAO],
      ) as Promise<Array<Record<string, unknown>>>,
      this.produtos.estoqueBaixo({ page: 1, limit: 1 }),
    ]);

    const faturamento = numero(atual.faturamento);
    const quantidade = Number(atual.quantidade ?? 0);
    const faturamentoAnterior = numero(passado.faturamento);
    const quantidadeAnterior = Number(passado.quantidade ?? 0);

    return {
      periodo,
      faturamento,
      quantidadeVendas: quantidade,
      ticketMedio: quantidade ? paraReais(Math.round(paraCentavos(faturamento) / quantidade)) : 0,
      descontos: numero(atual.descontos),
      itensVendidos: numero(itens.quantidade, 3),
      clientesAtendidos: Number(atual.clientes ?? 0),
      formasPagamento: {
        dinheiro: numero(atual.dinheiro),
        pix: numero(atual.pix),
        cartao: numero(atual.cartao),
        carne: numero(atual.carne),
        outros: numero(atual.outros),
      },
      recebimentosCarne: { quantidade: Number(recebimentos.quantidade ?? 0), total: numero(recebimentos.total) },
      carneEmAberto: {
        parcelas: Number(carne.parcelas ?? 0),
        total: numero(carne.total),
        parcelasVencidas: Number(carne.parcelas_vencidas ?? 0),
        totalVencido: numero(carne.total_vencido),
      },
      produtosEstoqueBaixo: estoqueBaixo.meta.total,
      comparativo: {
        periodoAnterior: anterior,
        faturamentoAnterior,
        quantidadeVendasAnterior: quantidadeAnterior,
        variacaoFaturamentoPercentual: variacao(faturamento, faturamentoAnterior),
        variacaoQuantidadePercentual: variacao(quantidade, quantidadeAnterior),
      },
    };
  }

  async faturamento(filtro: FaturamentoDto) {
    const periodo = this.resolverPeriodo(filtro);
    const agrupamento = filtro.agrupar === 'mes' ? "DATE_FORMAT(v.data_venda, '%Y-%m')" : 'v.data_venda';
    const linhas = (await this.fonte.query(
      `SELECT ${agrupamento} AS periodo, COUNT(*) AS quantidade, SUM(v.vr_total) AS faturamento,
              SUM(v.vr_adicional) AS descontos
         FROM mv_vendas v WHERE ${VENDA_VALIDA}
        GROUP BY periodo ORDER BY periodo`,
      [periodo.inicio, periodo.fim],
    )) as Array<Record<string, unknown>>;
    const serie = linhas.map((linha) => ({
      periodo: String(linha.periodo),
      quantidadeVendas: Number(linha.quantidade),
      faturamento: numero(linha.faturamento),
      descontos: numero(linha.descontos),
    }));
    return {
      periodo,
      agrupamento: filtro.agrupar ?? 'dia',
      total: paraReais(somar(serie.map((item) => paraCentavos(item.faturamento)))),
      serie,
    };
  }

  async vendasPeriodo(filtro: VendasPeriodoDto) {
    const periodo = this.resolverPeriodo(filtro);
    const [lista, [resumo]] = await Promise.all([
      this.vendas.listar({ ...filtro, ...periodo, ordem: 'recentes' }),
      this.agregadoVendas(periodo, filtro.formaPagamento ? `v.${COLUNA_FORMA[filtro.formaPagamento]} > 0` : null),
    ]);
    return {
      ...lista,
      resumo: {
        periodo,
        quantidadeVendas: Number(resumo.quantidade ?? 0),
        faturamento: numero(resumo.faturamento),
        descontos: numero(resumo.descontos),
        formasPagamento: {
          dinheiro: numero(resumo.dinheiro),
          pix: numero(resumo.pix),
          cartao: numero(resumo.cartao),
          carne: numero(resumo.carne),
          outros: numero(resumo.outros),
        },
      },
    };
  }

  async produtosMaisVendidos(filtro: MaisVendidosDto) {
    const periodo = this.resolverPeriodo(filtro);
    const ordem = filtro.ordenarPor === 'valor' ? 'valor DESC' : 'quantidade DESC';
    const linhas = (await this.fonte.query(
      `SELECT m.id_produto, p.nome_produto, p.cod_barra, SUM(m.quant) AS quantidade, SUM(m.vr_total) AS valor,
              COUNT(DISTINCT m.controle) AS vendas
         FROM mv_vendas_movimento m LEFT JOIN cad_produtos p ON p.id = m.id_produto
        WHERE m.estornado = 0 AND m.modo_venda = ? AND m.data_venda BETWEEN ? AND ?
        GROUP BY m.id_produto, p.nome_produto, p.cod_barra
        ORDER BY ${ordem} LIMIT ?`,
      [MODO_VENDA.PRODUTO, periodo.inicio, periodo.fim, filtro.limite ?? 10],
    )) as Array<Record<string, unknown>>;
    return {
      periodo,
      produtos: linhas.map((linha, indice) => ({
        posicao: indice + 1,
        idProduto: Number(linha.id_produto),
        produto: (linha.nome_produto as string | null) ?? `Produto removido (#${String(linha.id_produto)})`,
        codigoBarras: (linha.cod_barra as string | null) ?? null,
        quantidade: numero(linha.quantidade, 3),
        valor: numero(linha.valor),
        vendas: Number(linha.vendas),
      })),
    };
  }

  async vendasPorCliente(filtro: VendasPorClienteDto) {
    const periodo = this.resolverPeriodo(filtro);
    const filtroCliente = filtro.incluirNaoIdentificado ? '' : 'AND v.id_cliente > 0';
    const linhas = (await this.fonte.query(
      `SELECT v.id_cliente, c.nome_cliente, COUNT(*) AS quantidade, SUM(v.vr_total) AS total,
              MAX(v.data_venda) AS ultima_compra
         FROM mv_vendas v LEFT JOIN cad_clientes c ON c.id = v.id_cliente
        WHERE ${VENDA_VALIDA} ${filtroCliente}
        GROUP BY v.id_cliente, c.nome_cliente
        ORDER BY total DESC LIMIT ?`,
      [periodo.inicio, periodo.fim, filtro.limite ?? 10],
    )) as Array<Record<string, unknown>>;
    return {
      periodo,
      clientes: linhas.map((linha, indice) => {
        const idCliente = Number(linha.id_cliente ?? 0);
        const total = numero(linha.total);
        const quantidade = Number(linha.quantidade);
        return {
          posicao: indice + 1,
          idCliente,
          cliente: idCliente > 0 ? ((linha.nome_cliente as string | null) ?? `Cliente #${idCliente}`) : 'Não identificado',
          quantidadeVendas: quantidade,
          total,
          ticketMedio: quantidade ? paraReais(Math.round(paraCentavos(total) / quantidade)) : 0,
          ultimaCompra: (linha.ultima_compra as string | null) ?? null,
        };
      }),
    };
  }

  /** Clientes com parcelas de carnê em aberto. */
  async clientesDebito(paginacao: PaginacaoDto) {
    const hoje = dataNoFuso(new Date(), this.config.fusoHorario);
    const base = `FROM mv_financeiro f WHERE f.origem_lancamento = ? AND f.efetuado = ? AND f.estornado = 0`;
    const parametros = [ORIGEM_FINANCEIRO.CARNE, NAO];
    const [linhas, [{ total }], [totais]] = await Promise.all([
      this.fonte.query(
        `SELECT f.id_cliente, c.nome_cliente, c.telefone, c.celular,
                COUNT(*) AS parcelas, SUM(f.vr_parcela) AS valor_aberto, MIN(f.data_vencimento) AS proximo_vencimento,
                SUM(f.data_vencimento < ?) AS parcelas_vencidas,
                SUM(CASE WHEN f.data_vencimento < ? THEN f.vr_parcela ELSE 0 END) AS valor_vencido
           ${base.replace('FROM mv_financeiro f', 'FROM mv_financeiro f LEFT JOIN cad_clientes c ON c.id = f.id_cliente')}
          GROUP BY f.id_cliente, c.nome_cliente, c.telefone, c.celular
          ORDER BY valor_vencido DESC, valor_aberto DESC LIMIT ? OFFSET ?`,
        [hoje, hoje, ...parametros, paginacao.limit, offset(paginacao)],
      ) as Promise<Array<Record<string, unknown>>>,
      this.fonte.query(`SELECT COUNT(DISTINCT f.id_cliente) AS total ${base}`, parametros) as Promise<
        Array<{ total: number | string }>
      >,
      this.fonte.query(`SELECT SUM(f.vr_parcela) AS valor ${base}`, parametros) as Promise<Array<Record<string, unknown>>>,
    ]);
    return {
      ...paginado(
        linhas.map((linha) => ({
          idCliente: Number(linha.id_cliente),
          cliente: (linha.nome_cliente as string | null) ?? `Cliente #${String(linha.id_cliente)}`,
          telefone: (linha.telefone as string | null) ?? null,
          celular: (linha.celular as string | null) ?? null,
          parcelasEmAberto: Number(linha.parcelas),
          valorEmAberto: numero(linha.valor_aberto),
          parcelasVencidas: Number(linha.parcelas_vencidas ?? 0),
          valorVencido: numero(linha.valor_vencido),
          proximoVencimento: (linha.proximo_vencimento as string | null) ?? null,
        })),
        Number(total),
        paginacao.page,
        paginacao.limit,
      ),
      resumo: { valorTotalEmAberto: numero(totais.valor) },
    };
  }

  /** Parcelas de carnê recebidas no período (pela data de pagamento). */
  async baixasCarne(filtro: PeriodoPaginadoDto) {
    const periodo = this.resolverPeriodo(filtro);
    const where = `WHERE f.origem_lancamento = ? AND f.efetuado = ? AND f.estornado = 0
                     AND f.data_pagamento BETWEEN ? AND ?`;
    const parametros = [ORIGEM_FINANCEIRO.CARNE, SIM, periodo.inicio, periodo.fim];
    const [linhas, [totais]] = await Promise.all([
      this.fonte.query(
        `SELECT f.id, f.cod_carne, f.parcela, f.data_pagamento, f.data_vencimento, f.vr_parcela, f.vr_pago,
                f.vr_juros, f.vr_desconto, f.id_cliente, c.nome_cliente
           FROM mv_financeiro f LEFT JOIN cad_clientes c ON c.id = f.id_cliente
           ${where} ORDER BY f.data_pagamento DESC, f.id DESC LIMIT ? OFFSET ?`,
        [...parametros, filtro.limit, offset(filtro)],
      ) as Promise<Array<Record<string, unknown>>>,
      this.fonte.query(
        `SELECT COUNT(*) AS quantidade, SUM(f.vr_pago) AS total FROM mv_financeiro f ${where}`,
        parametros,
      ) as Promise<Array<Record<string, unknown>>>,
    ]);
    return {
      ...paginado(
        linhas.map((linha) => ({
          id: Number(linha.id),
          codigo: (linha.cod_carne as string | null) ?? null,
          parcela: Number(linha.parcela),
          data: (linha.data_pagamento as string | null) ?? null,
          vencimento: (linha.data_vencimento as string | null) ?? null,
          idCliente: Number(linha.id_cliente ?? 0),
          cliente: (linha.nome_cliente as string | null) ?? null,
          valorParcela: numero(linha.vr_parcela),
          juros: numeroOuNulo(linha.vr_juros),
          desconto: numeroOuNulo(linha.vr_desconto),
          valorPago: numero(linha.vr_pago),
        })),
        Number(totais.quantidade ?? 0),
        filtro.page,
        filtro.limit,
      ),
      resumo: { periodo, quantidade: Number(totais.quantidade ?? 0), total: numero(totais.total) },
    };
  }

  /** Mercadorias lançadas por nota no período e o investimento (quantidade × custo). */
  async mercadorias(filtro: PeriodoPaginadoDto) {
    const periodo = this.resolverPeriodo(filtro);
    const where = `WHERE h.estornado = 0 AND h.data_lanca BETWEEN ? AND ?
                     AND (h.numerodanota IS NULL OR (h.numerodanota NOT LIKE '${PREFIXO_NOTA_AJUSTE}%' AND h.numerodanota NOT LIKE 'V%'))`;
    const parametros = [periodo.inicio, periodo.fim];
    const [linhas, [totais]] = await Promise.all([
      this.fonte.query(
        `SELECT h.id, h.data_lanca, h.numerodanota, h.id_produto, p.nome_produto, h.quantidade, h.vr_compra,
                f.nome_fornecedor
           FROM mv_estoque_historico h
           LEFT JOIN cad_produtos p ON p.id = h.id_produto
           LEFT JOIN cad_fornecedores f ON f.id = h.id_fornecedor
           ${where} ORDER BY h.data_lanca DESC, h.id DESC LIMIT ? OFFSET ?`,
        [...parametros, filtro.limit, offset(filtro)],
      ) as Promise<Array<Record<string, unknown>>>,
      this.fonte.query(
        `SELECT COUNT(*) AS quantidade, SUM(h.quantidade) AS itens, SUM(ROUND(h.quantidade * h.vr_compra, 2)) AS investimento
           FROM mv_estoque_historico h ${where}`,
        parametros,
      ) as Promise<Array<Record<string, unknown>>>,
    ]);
    return {
      ...paginado(
        linhas.map((linha) => {
          const quantidade = numero(linha.quantidade, 3);
          const valorCompra = numero(linha.vr_compra);
          return {
            id: Number(linha.id),
            dataCadastro: (linha.data_lanca as string | null) ?? null,
            numeroNota: (linha.numerodanota as string | null) ?? null,
            idProduto: Number(linha.id_produto),
            produto: (linha.nome_produto as string | null) ?? `Produto removido (#${String(linha.id_produto)})`,
            fornecedor: (linha.nome_fornecedor as string | null) ?? null,
            quantidade,
            valorCompra,
            investimento: paraReais(multiplicar(paraCentavos(valorCompra), quantidade)),
          };
        }),
        Number(totais.quantidade ?? 0),
        filtro.page,
        filtro.limit,
      ),
      resumo: {
        periodo,
        lancamentos: Number(totais.quantidade ?? 0),
        itens: numero(totais.itens, 3),
        investimento: numero(totais.investimento),
      },
    };
  }

  async formasPagamento(filtro: PeriodoDto) {
    const periodo = this.resolverPeriodo(filtro);
    const [linha] = await this.agregadoVendas(periodo);
    const valores = {
      dinheiro: numero(linha.dinheiro),
      pix: numero(linha.pix),
      cartao: numero(linha.cartao),
      carne: numero(linha.carne),
      outros: numero(linha.outros),
    };
    const totalCentavos = somar(Object.values(valores).map(paraCentavos));
    return {
      periodo,
      total: paraReais(totalCentavos),
      formas: Object.entries(valores).map(([forma, valor]) => ({
        forma,
        valor,
        percentual: totalCentavos ? arredondarCasas((paraCentavos(valor) / totalCentavos) * 100, 2) : 0,
      })),
    };
  }

  estoqueBaixo = (filtro: Parameters<ProdutosService['estoqueBaixo']>[0]) => this.produtos.estoqueBaixo(filtro);

  private agregadoVendas(periodo: Periodo, condicaoExtra: string | null = null): Promise<Array<Record<string, unknown>>> {
    return this.fonte.query(
      `SELECT COUNT(*) AS quantidade, SUM(v.vr_total) AS faturamento, SUM(v.vr_adicional) AS descontos,
              SUM(v.vr_dinheiro) AS dinheiro, SUM(v.vr_pix) AS pix, SUM(v.vr_cartao) AS cartao,
              SUM(v.vr_carne) AS carne, SUM(COALESCE(v.vr_cheque, 0) + COALESCE(v.vr_ticket, 0)) AS outros,
              COUNT(DISTINCT NULLIF(v.id_cliente, 0)) AS clientes
         FROM mv_vendas v WHERE ${VENDA_VALIDA} ${condicaoExtra ? `AND ${condicaoExtra}` : ''}`,
      [periodo.inicio, periodo.fim],
    ) as Promise<Array<Record<string, unknown>>>;
  }
}

