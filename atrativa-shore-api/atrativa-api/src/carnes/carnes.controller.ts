import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { RequerPermissao } from '../acesso/acesso.decorators.js';
import { Auditar } from '../auditoria/auditar.decorator.js';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { UsuarioAutenticado } from '../auth/usuario-autenticado.js';
import { UsuarioAtual } from '../common/decorators/usuario-atual.decorator.js';
import { CarnesService } from './carnes.service.js';
import { BaixaCarneDto, ListarCarnesDto } from './dto/carne.dto.js';

@ApiTags('Carnês')
@ApiBearerAuth()
@Controller('carnes')
export class CarnesController {
  constructor(private readonly carnes: CarnesService) {}

  @RequerPermissao('carnes.consultar')
  @Get()
  @ApiOperation({ summary: 'Parcelas de carnê (padrão: em aberto), por cliente, situação ou vencimento' })
  listar(@Query() filtro: ListarCarnesDto) {
    return this.carnes.listar(filtro);
  }

  @RequerPermissao('carnes.consultar')
  @Get(':codigo')
  @ApiOperation({ summary: 'Consulta uma parcela pelo código do carnê (13 dígitos)' })
  obter(@Param('codigo') codigo: string) {
    return this.carnes.obter(codigo);
  }

  @RequerPermissao('carnes.receber')
  @Auditar('carne.receber', 'parcela_carne')
  @Post('baixa')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Recebe (dá baixa em) uma ou mais parcelas, com juros e desconto opcionais' })
  baixar(@Body() dto: BaixaCarneDto, @UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.carnes.baixar(dto, usuario);
  }
}
