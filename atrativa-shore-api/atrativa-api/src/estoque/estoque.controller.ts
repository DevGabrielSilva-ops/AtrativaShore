import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { UsuarioAutenticado } from '../auth/usuario-autenticado.js';
import { SomenteAdministrador } from '../common/decorators/administrador.decorator.js';
import { UsuarioAtual } from '../common/decorators/usuario-atual.decorator.js';
import { ListarProdutosDto } from '../produtos/dto/produto.dto.js';
import { ListarMovimentacoesDto, RegistrarAjusteDto, RegistrarEntradaDto } from './dto/estoque.dto.js';
import { EstoqueService } from './estoque.service.js';

@ApiTags('Estoque')
@ApiBearerAuth()
@Controller('estoque')
export class EstoqueController {
  constructor(private readonly estoque: EstoqueService) {}

  @Get()
  @ApiOperation({ summary: 'Saldo de estoque dos produtos (use somenteDisponiveis=true para ver só os com saldo)' })
  listar(@Query() filtro: ListarProdutosDto) {
    return this.estoque.listar(filtro);
  }

  @Get('movimentacoes')
  @ApiOperation({ summary: 'Histórico de movimentações: entradas, trocas, ajustes e vendas' })
  movimentacoes(@Query() filtro: ListarMovimentacoesDto) {
    return this.estoque.movimentacoes(filtro);
  }

  @Get(':idProduto')
  @ApiOperation({ summary: 'Saldo de um produto com as últimas movimentações' })
  saldo(@Param('idProduto', ParseIntPipe) idProduto: number) {
    return this.estoque.saldo(idProduto);
  }

  @Post('entradas')
  @ApiOperation({
    summary: 'Lança uma nota de entrada de mercadorias',
    description: 'Grava o histórico, soma no saldo e cria a conta a pagar, como o sistema desktop faz.',
  })
  registrarEntrada(@Body() dto: RegistrarEntradaDto, @UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.estoque.registrarEntrada(dto, usuario);
  }

  @Post('ajustes')
  @SomenteAdministrador()
  @ApiOperation({
    summary: 'Ajuste manual de estoque (somente administrador)',
    description: 'Quantidade negativa = saída (perda, avaria, uso). Fica registrado no histórico com o motivo.',
  })
  registrarAjuste(@Body() dto: RegistrarAjusteDto) {
    return this.estoque.registrarAjuste(dto);
  }
}
