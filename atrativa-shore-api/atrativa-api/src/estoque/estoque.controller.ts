import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { RequerPermissao } from '../acesso/acesso.decorators.js';
import { Auditar } from '../auditoria/auditar.decorator.js';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { UsuarioAutenticado } from '../auth/usuario-autenticado.js';
import { UsuarioAtual } from '../common/decorators/usuario-atual.decorator.js';
import { ListarProdutosDto } from '../produtos/dto/produto.dto.js';
import { ListarMovimentacoesDto, RegistrarAjusteDto, RegistrarEntradaDto } from './dto/estoque.dto.js';
import { EstoqueService } from './estoque.service.js';

@ApiTags('Estoque')
@ApiBearerAuth()
@Controller('estoque')
export class EstoqueController {
  constructor(private readonly estoque: EstoqueService) {}

  @RequerPermissao('estoque.consultar')
  @Get()
  @ApiOperation({ summary: 'Saldo de estoque dos produtos (use somenteDisponiveis=true para ver só os com saldo)' })
  listar(@Query() filtro: ListarProdutosDto) {
    return this.estoque.listar(filtro);
  }

  @RequerPermissao('estoque.consultar')
  @Get('movimentacoes')
  @ApiOperation({ summary: 'Histórico de movimentações: entradas, trocas, ajustes e vendas' })
  movimentacoes(@Query() filtro: ListarMovimentacoesDto) {
    return this.estoque.movimentacoes(filtro);
  }

  @RequerPermissao('estoque.consultar')
  @Get(':idProduto')
  @ApiOperation({ summary: 'Saldo de um produto com as últimas movimentações' })
  saldo(@Param('idProduto', ParseIntPipe) idProduto: number) {
    return this.estoque.saldo(idProduto);
  }

  @RequerPermissao('estoque.entrada')
  @Auditar('estoque.entrada', 'estoque')
  @Post('entradas')
  @ApiOperation({
    summary: 'Lança uma nota de entrada de mercadorias',
    description: 'Grava o histórico, soma no saldo e cria a conta a pagar, como o sistema desktop faz.',
  })
  registrarEntrada(@Body() dto: RegistrarEntradaDto, @UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.estoque.registrarEntrada(dto, usuario);
  }

  @RequerPermissao('estoque.ajuste')
  @Auditar('estoque.ajuste', 'estoque')
  @Post('ajustes')
  @ApiOperation({
    summary: 'Ajuste manual de estoque (somente administrador)',
    description: 'Quantidade negativa = saída (perda, avaria, uso). Fica registrado no histórico com o motivo.',
  })
  registrarAjuste(@Body() dto: RegistrarAjusteDto) {
    return this.estoque.registrarAjuste(dto);
  }
}
