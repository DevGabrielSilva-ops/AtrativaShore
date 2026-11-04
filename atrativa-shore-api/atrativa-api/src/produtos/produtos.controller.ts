import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AtualizarProdutoDto,
  CriarProdutoDto,
  EstoqueBaixoDto,
  ListarProdutosDto,
} from './dto/produto.dto.js';
import { ProdutosService } from './produtos.service.js';

@ApiTags('Produtos')
@ApiBearerAuth()
@Controller('produtos')
export class ProdutosController {
  constructor(private readonly produtos: ProdutosService) {}

  @Get()
  @ApiOperation({ summary: 'Lista produtos com preço, saldo e lucro bruto (busca por nome, código ou id)' })
  listar(@Query() filtro: ListarProdutosDto) {
    return this.produtos.listar(filtro);
  }

  @Get('estoque-baixo')
  @ApiOperation({ summary: 'Produtos com saldo menor ou igual ao estoque mínimo (ou ao limite informado)' })
  estoqueBaixo(@Query() filtro: EstoqueBaixoDto) {
    return this.produtos.estoqueBaixo(filtro);
  }

  @Get('tipos')
  @ApiOperation({ summary: 'Categorias de produto (cad_produtos_tipo)' })
  tipos() {
    return this.produtos.listarTipos();
  }

  @Get('codigo/:codigoBarras')
  @ApiOperation({ summary: 'Busca exata por código de barras (leitor do PDV)' })
  porCodigo(@Param('codigoBarras') codigoBarras: string) {
    return this.produtos.obterPorCodigo(codigoBarras);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consulta um produto' })
  obter(@Param('id', ParseIntPipe) id: number) {
    return this.produtos.obter(id);
  }

  @Post()
  @ApiOperation({ summary: 'Cadastra um produto (cria também o saldo zerado em mv_estoque)' })
  criar(@Body() dto: CriarProdutoDto) {
    return this.produtos.criar(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza um produto (quantidade só muda por entrada, ajuste ou venda)' })
  atualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: AtualizarProdutoDto) {
    return this.produtos.atualizar(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Exclui um produto sem vendas, movimentação nem saldo (409 se houver)' })
  async remover(@Param('id', ParseIntPipe) id: number) {
    await this.produtos.remover(id);
  }
}
