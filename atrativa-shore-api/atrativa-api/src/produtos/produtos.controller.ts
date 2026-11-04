import { RequerPermissao } from '../acesso/acesso.decorators.js';
import { Auditar } from '../auditoria/auditar.decorator.js';
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

  @RequerPermissao('produtos.consultar')
  @Get()
  @ApiOperation({ summary: 'Lista produtos com preço, saldo e lucro bruto (busca por nome, código ou id)' })
  listar(@Query() filtro: ListarProdutosDto) {
    return this.produtos.listar(filtro);
  }

  @RequerPermissao('estoque.consultar')
  @Get('estoque-baixo')
  @ApiOperation({ summary: 'Produtos com saldo menor ou igual ao estoque mínimo (ou ao limite informado)' })
  estoqueBaixo(@Query() filtro: EstoqueBaixoDto) {
    return this.produtos.estoqueBaixo(filtro);
  }

  @RequerPermissao('produtos.consultar')
  @Get('tipos')
  @ApiOperation({ summary: 'Categorias de produto (cad_produtos_tipo)' })
  tipos() {
    return this.produtos.listarTipos();
  }

  @RequerPermissao('produtos.consultar')
  @Get('codigo/:codigoBarras')
  @ApiOperation({ summary: 'Busca exata por código de barras (leitor do PDV)' })
  porCodigo(@Param('codigoBarras') codigoBarras: string) {
    return this.produtos.obterPorCodigo(codigoBarras);
  }

  @RequerPermissao('produtos.consultar')
  @Get(':id')
  @ApiOperation({ summary: 'Consulta um produto' })
  obter(@Param('id', ParseIntPipe) id: number) {
    return this.produtos.obter(id);
  }

  @RequerPermissao('produtos.gerenciar')
  @Auditar('produto.criar', 'produto')
  @Post()
  @ApiOperation({ summary: 'Cadastra um produto (cria também o saldo zerado em mv_estoque)' })
  criar(@Body() dto: CriarProdutoDto) {
    return this.produtos.criar(dto);
  }

  @RequerPermissao('produtos.gerenciar')
  @Auditar('produto.atualizar', 'produto')
  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza um produto (quantidade só muda por entrada, ajuste ou venda)' })
  atualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: AtualizarProdutoDto) {
    return this.produtos.atualizar(id, dto);
  }

  @RequerPermissao('produtos.gerenciar')
  @Auditar('produto.excluir', 'produto')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Exclui um produto sem vendas, movimentação nem saldo (409 se houver)' })
  async remover(@Param('id', ParseIntPipe) id: number) {
    await this.produtos.remover(id);
  }
}
