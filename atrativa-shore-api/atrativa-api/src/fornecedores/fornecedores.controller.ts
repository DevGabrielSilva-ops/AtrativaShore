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
  AtualizarFornecedorDto,
  CriarFornecedorDto,
  ListarFornecedoresDto,
} from './dto/fornecedor.dto.js';
import { FornecedoresService } from './fornecedores.service.js';

@ApiTags('Fornecedores')
@ApiBearerAuth()
@Controller('fornecedores')
export class FornecedoresController {
  constructor(private readonly fornecedores: FornecedoresService) {}

  @Get()
  @ApiOperation({ summary: 'Lista fornecedores' })
  listar(@Query() filtro: ListarFornecedoresDto) {
    return this.fornecedores.listar(filtro);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consulta um fornecedor' })
  obter(@Param('id', ParseIntPipe) id: number) {
    return this.fornecedores.obter(id);
  }

  @Post()
  @ApiOperation({ summary: 'Cadastra um fornecedor' })
  criar(@Body() dto: CriarFornecedorDto) {
    return this.fornecedores.criar(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza um fornecedor' })
  atualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: AtualizarFornecedorDto) {
    return this.fornecedores.atualizar(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Exclui um fornecedor sem produtos nem entradas (409 se houver)' })
  async remover(@Param('id', ParseIntPipe) id: number) {
    await this.fornecedores.remover(id);
  }
}
