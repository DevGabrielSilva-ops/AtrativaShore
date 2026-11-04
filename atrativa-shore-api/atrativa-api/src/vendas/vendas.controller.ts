import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { RequerPermissao } from '../acesso/acesso.decorators.js';
import { Auditar } from '../auditoria/auditar.decorator.js';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { temPermissao } from '../acesso/acesso.guard.js';
import { idLoginDe, type UsuarioAutenticado } from '../auth/usuario-autenticado.js';
import { UsuarioAtual } from '../common/decorators/usuario-atual.decorator.js';
import { ListarVendasDto, RegistrarVendaDto } from './dto/venda.dto.js';
import { VendasService } from './vendas.service.js';

function vendedorPermitido(usuario: UsuarioAutenticado, solicitado?: number): number | undefined {
  if (temPermissao(usuario, 'vendas.consultar_todas')) return solicitado;
  return idLoginDe(usuario);
}

@ApiTags('Vendas')
@ApiBearerAuth()
@Controller('vendas')
export class VendasController {
  constructor(private readonly vendas: VendasService) {}

  @RequerPermissao('vendas.registrar')
  @Auditar('venda.registrar', 'venda')
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

  @RequerPermissao('vendas.consultar')
  @Get()
  @ApiOperation({ summary: 'Histórico de vendas, com filtro por período, cliente e forma de pagamento' })
  listar(@Query() filtro: ListarVendasDto, @UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.vendas.listar(filtro, vendedorPermitido(usuario, filtro.idVendedor));
  }

  @RequerPermissao('vendas.consultar')
  @Get('controle/:controle')
  @ApiOperation({ summary: 'Consulta uma venda pelo controle (yyyymmddhhmmss)' })
  porControle(@Param('controle') controle: string, @UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.vendas.obterPorControle(controle, vendedorPermitido(usuario));
  }

  @RequerPermissao('vendas.consultar')
  @Get(':id')
  @ApiOperation({ summary: 'Consulta uma venda com itens, trocas, pagamentos e parcelas do carnê' })
  obter(@Param('id', ParseIntPipe) id: number, @UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.vendas.obter(id, vendedorPermitido(usuario));
  }

  @RequerPermissao('vendas.estornar')
  @Auditar('venda.estornar', 'venda')
  @Post(':id/estorno')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Estorna (cancela) uma venda e devolve os itens ao estoque (somente administrador)' })
  estornar(@Param('id', ParseIntPipe) id: number) {
    return this.vendas.estornar(id);
  }
}

@ApiTags('Clientes')
@ApiBearerAuth()
@Controller('clientes')
export class VendasDoClienteController {
  constructor(private readonly vendas: VendasService) {}

  @RequerPermissao('clientes.consultar')
  @Get(':id/vendas')
  @ApiOperation({ summary: 'Vendas de um cliente' })
  listar(
    @Param('id', ParseIntPipe) id: number,
    @Query() filtro: ListarVendasDto,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ) {
    return this.vendas.listar({ ...filtro, idCliente: id }, vendedorPermitido(usuario, filtro.idVendedor));
  }
}
