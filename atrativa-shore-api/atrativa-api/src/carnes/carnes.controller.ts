import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { RequerPermissao } from '../acesso/acesso.decorators.js';
import { Auditar } from '../auditoria/auditar.decorator.js';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { UsuarioAutenticado } from '../auth/usuario-autenticado.js';
import { UsuarioAtual } from '../common/decorators/usuario-atual.decorator.js';
import { CarnesService } from './carnes.service.js';
import { BaixaCarneDto, ConfigCarneDto, ListarCarnesDto, SimularBaixaDto } from './dto/carne.dto.js';

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
  @Get('configuracao')
  @ApiOperation({ summary: 'Juros ao dia e carência usados no carnê' })
  configuracao() {
    return this.carnes.configuracao();
  }

  @RequerPermissao('empresa.configurar')
  @Auditar('carne.configuracao', 'config_carne')
  @Patch('configuracao')
  @ApiOperation({ summary: 'Altera juros ao dia e carência do carnê' })
  atualizarConfiguracao(@Body() dto: ConfigCarneDto) {
    return this.carnes.atualizarConfiguracao(dto);
  }

  @RequerPermissao('carnes.consultar')
  @Get('venda/:controle/impressao')
  @ApiOperation({ summary: 'Dados para imprimir (ou reimprimir) o carnê de uma venda' })
  impressao(@Param('controle') controle: string) {
    return this.carnes.impressao(controle);
  }

  @RequerPermissao('carnes.receber')
  @Post('simulacao')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Calcula os juros das parcelas para uma data de pagamento, sem gravar' })
  simular(@Body() dto: SimularBaixaDto) {
    return this.carnes.simular(dto);
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
  @ApiOperation({ summary: 'Recebe uma ou mais parcelas em dinheiro, Pix e/ou cartão, com juros calculados pelo sistema' })
  baixar(@Body() dto: BaixaCarneDto, @UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.carnes.baixar(dto, usuario);
  }
}
