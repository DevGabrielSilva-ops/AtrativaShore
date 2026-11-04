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
import { ClientesService } from './clientes.service.js';
import { AtualizarClienteDto, CriarClienteDto, ListarClientesDto } from './dto/cliente.dto.js';

@ApiTags('Clientes')
@ApiBearerAuth()
@Controller('clientes')
export class ClientesController {
  constructor(private readonly clientes: ClientesService) {}

  @Get()
  @ApiOperation({ summary: 'Lista clientes (busca por nome, CPF/CNPJ, código ou id)' })
  listar(@Query() filtro: ListarClientesDto) {
    return this.clientes.listar(filtro);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consulta um cliente' })
  obter(@Param('id', ParseIntPipe) id: number) {
    return this.clientes.obter(id);
  }

  @Post()
  @ApiOperation({ summary: 'Cadastra um cliente (o código de barras é gerado no padrão do desktop)' })
  criar(@Body() dto: CriarClienteDto) {
    return this.clientes.criar(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza dados do cliente' })
  atualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: AtualizarClienteDto) {
    return this.clientes.atualizar(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Exclui um cliente sem vendas nem carnês (409 se houver)' })
  async remover(@Param('id', ParseIntPipe) id: number) {
    await this.clientes.remover(id);
  }
}
