import { Controller, Get, Query } from '@nestjs/common';
import { RequerPermissao } from '../acesso/acesso.decorators.js';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaginacaoDto } from '../common/dto/paginacao.dto.js';
import { PeriodoDto, PeriodoPaginadoDto } from '../common/dto/periodo.dto.js';
import { ListarMovimentacoesDto } from '../estoque/dto/estoque.dto.js';
import { EstoqueService } from '../estoque/estoque.service.js';
import { EstoqueBaixoDto } from '../produtos/dto/produto.dto.js';
import {
  FaturamentoDto,
  MaisVendidosDto,
  VendasDiaDto,
  VendasPeriodoDto,
  VendasPorClienteDto,
} from './dto/relatorios.dto.js';
import { RelatoriosService } from './relatorios.service.js';

const PERIODO_PADRAO = 'Sem inicio/fim, usa o mês corrente (dia 1º até hoje).';

@ApiTags('Relatórios')
@ApiBearerAuth()
@Controller('relatorios')
export class RelatoriosController {
  constructor(
    private readonly relatorios: RelatoriosService,
    private readonly estoque: EstoqueService,
  ) {}

  @RequerPermissao('dashboard.ver')
  @Get('dashboard')
  @ApiOperation({
    summary: 'Indicadores gerais: faturamento, vendas, ticket médio, carnês, estoque baixo e comparativo',
    description: PERIODO_PADRAO,
  })
  dashboard(@Query() periodo: PeriodoDto) {
    return this.relatorios.dashboard(periodo);
  }

  @RequerPermissao('relatorios.vendas')
  @Get('faturamento')
  @ApiOperation({ summary: 'Faturamento por dia ou por mês', description: PERIODO_PADRAO })
  faturamento(@Query() filtro: FaturamentoDto) {
    return this.relatorios.faturamento(filtro);
  }

  @RequerPermissao('relatorios.vendas')
  @Get('vendas-periodo')
  @ApiOperation({ summary: 'Vendas do período com totais por forma de pagamento', description: PERIODO_PADRAO })
  vendasPeriodo(@Query() filtro: VendasPeriodoDto) {
    return this.relatorios.vendasPeriodo(filtro);
  }

  @RequerPermissao('relatorios.vendas')
  @Get('vendas-dia')
  @ApiOperation({ summary: 'Vendas de um dia (padrão: hoje)' })
  vendasDia(@Query() filtro: VendasDiaDto) {
    const data = filtro.data;
    return this.relatorios.vendasPeriodo({
      ...(data ? { inicio: data, fim: data } : this.relatorios.diaAtual()),
      page: 1,
      limit: 100,
    });
  }

  @RequerPermissao('relatorios.vendas')
  @Get('formas-pagamento')
  @ApiOperation({ summary: 'Participação de cada forma de pagamento', description: PERIODO_PADRAO })
  formasPagamento(@Query() periodo: PeriodoDto) {
    return this.relatorios.formasPagamento(periodo);
  }

  @RequerPermissao('relatorios.vendas')
  @Get('produtos-mais-vendidos')
  @ApiOperation({ summary: 'Ranking de produtos por quantidade ou valor', description: PERIODO_PADRAO })
  maisVendidos(@Query() filtro: MaisVendidosDto) {
    return this.relatorios.produtosMaisVendidos(filtro);
  }

  @RequerPermissao('relatorios.vendas')
  @Get('vendas-por-cliente')
  @ApiOperation({ summary: 'Ranking de clientes por valor comprado', description: PERIODO_PADRAO })
  vendasPorCliente(@Query() filtro: VendasPorClienteDto) {
    return this.relatorios.vendasPorCliente(filtro);
  }

  @RequerPermissao('relatorios.estoque')
  @Get('estoque-baixo')
  @ApiOperation({ summary: 'Produtos com menor quantidade em estoque' })
  estoqueBaixo(@Query() filtro: EstoqueBaixoDto) {
    return this.relatorios.estoqueBaixo(filtro);
  }

  @RequerPermissao('relatorios.vendas')
  @Get('clientes-debito')
  @ApiOperation({ summary: 'Clientes com parcelas de carnê em aberto' })
  clientesDebito(@Query() paginacao: PaginacaoDto) {
    return this.relatorios.clientesDebito(paginacao);
  }

  @RequerPermissao('relatorios.vendas')
  @Get('baixas-carne')
  @ApiOperation({ summary: 'Parcelas de carnê recebidas no período', description: PERIODO_PADRAO })
  baixasCarne(@Query() filtro: PeriodoPaginadoDto) {
    return this.relatorios.baixasCarne(filtro);
  }

  @RequerPermissao('relatorios.estoque')
  @Get('mercadorias')
  @ApiOperation({ summary: 'Mercadorias lançadas por nota e investimento', description: PERIODO_PADRAO })
  mercadorias(@Query() filtro: PeriodoPaginadoDto) {
    return this.relatorios.mercadorias(filtro);
  }

  @RequerPermissao('relatorios.estoque')
  @Get('movimentacoes')
  @ApiOperation({ summary: 'Histórico de movimentações de estoque' })
  movimentacoes(@Query() filtro: ListarMovimentacoesDto) {
    return this.estoque.movimentacoes(filtro);
  }
}
