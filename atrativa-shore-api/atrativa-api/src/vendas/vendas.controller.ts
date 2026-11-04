import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { UsuarioAutenticado } from '../auth/usuario-autenticado.js';
import { SomenteAdministrador } from '../common/decorators/administrador.decorator.js';
import { UsuarioAtual } from '../common/decorators/usuario-atual.decorator.js';
import { ListarVendasDto, RegistrarVendaDto } from './dto/venda.dto.js';
import { VendasService } from './vendas.service.js';

@ApiTags('Vendas')
@ApiBearerAuth()
@Controller('vendas')
export class VendasController {
  constructor(private readonly vendas: VendasService) {}

  @Post()
  @ApiOperation({
    summary: 'Registra uma venda (cálculo, baixa de estoque e financeiro numa única transação)',
    description:
      'Totais são calculados pela API. Preço sugerido = preço a prazo; envie precoUnitario para alterar. ' +
      'Desconto e acréscimo são rateados nos itens. Use itensTroca para devoluções. ' +
      '409 se faltar estoque ou o caixa estiver fechado; 400 se os pagamentos não fecharem com o total.',
  })
  registrar(@Body() dto: RegistrarVendaDto, @UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.vendas.registrar(dto, usuario);
  }

  @Get()
  @ApiOperation({ summary: 'Histórico de vendas, com filtro por período, cliente e forma de pagamento' })
  listar(@Query() filtro: ListarVendasDto) {
    return this.vendas.listar(filtro);
  }

  @Get('controle/:controle')
  @ApiOperation({ summary: 'Consulta uma venda pelo controle (yyyymmddhhmmss)' })
  porControle(@Param('controle') controle: string) {
    return this.vendas.obterPorControle(controle);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consulta uma venda com itens, trocas, pagamentos e parcelas do carnê' })
  obter(@Param('id', ParseIntPipe) id: number) {
    return this.vendas.obter(id);
  }

  @Post(':id/estorno')
  @HttpCode(HttpStatus.OK)
  @SomenteAdministrador()
  @ApiOperation({ summary: 'Estorna (cancela) uma venda e devolve os itens ao estoque (somente administrador)' })
  estornar(@Param('id', ParseIntPipe) id: number) {
    return this.vendas.estornar(id);
  }
}

/** Rota aninhada /clientes/:id/vendas (fica aqui para não criar dependência circular entre módulos). */
@ApiTags('Clientes')
@ApiBearerAuth()
@Controller('clientes')
export class VendasDoClienteController {
  constructor(private readonly vendas: VendasService) {}

  @Get(':id/vendas')
  @ApiOperation({ summary: 'Vendas de um cliente' })
  listar(@Param('id', ParseIntPipe) id: number, @Query() filtro: ListarVendasDto) {
    return this.vendas.listar({ ...filtro, idCliente: id });
  }
}
