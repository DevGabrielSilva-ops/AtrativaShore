import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequerPermissao } from '../acesso/acesso.decorators.js';
import { ProdutosEtiquetaDto } from './dto/etiqueta.dto.js';
import { EtiquetasService } from './etiquetas.service.js';

@ApiTags('Etiquetas')
@ApiBearerAuth()
@Controller('etiquetas')
export class EtiquetasController {
  constructor(private readonly etiquetas: EtiquetasService) {}

  @RequerPermissao('produtos.consultar')
  @Get('modelos')
  @ApiOperation({ summary: 'Modelos de etiqueta de produto (eti_config/eti_config_campo), medidas em centímetros' })
  modelos() {
    return this.etiquetas.modelos();
  }

  @RequerPermissao('produtos.consultar')
  @Get('produtos')
  @ApiOperation({ summary: 'Dados de etiqueta (nome, código de barras cadastrado, tipo, fornecedor) dos produtos informados' })
  produtos(@Query() dto: ProdutosEtiquetaDto) {
    return this.etiquetas.produtos(dto);
  }
}
