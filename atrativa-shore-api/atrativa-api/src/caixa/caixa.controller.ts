import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { RequerPermissao } from '../acesso/acesso.decorators.js';
import { Auditar } from '../auditoria/auditar.decorator.js';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { UsuarioAutenticado } from '../auth/usuario-autenticado.js';
import { UsuarioAtual } from '../common/decorators/usuario-atual.decorator.js';
import { PaginacaoDto } from '../common/dto/paginacao.dto.js';
import { CaixaService } from './caixa.service.js';
import { AbrirCaixaDto, FecharCaixaDto } from './dto/caixa.dto.js';

@ApiTags('Caixa')
@ApiBearerAuth()
@Controller('caixa')
export class CaixaController {
  constructor(private readonly caixa: CaixaService) {}

  @RequerPermissao('caixa.operar')
  @Get('atual')
  @ApiOperation({ summary: 'Caixa aberto do terminal da API, com resumo por forma de pagamento (data: null se fechado)' })
  atual() {
    return this.caixa.atual();
  }

  @RequerPermissao('caixa.operar')
  @Get('historico')
  @ApiOperation({ summary: 'Aberturas e fechamentos anteriores deste terminal' })
  historico(@Query() paginacao: PaginacaoDto) {
    return this.caixa.historico(paginacao);
  }

  @RequerPermissao('caixa.operar')
  @Get(':id')
  @ApiOperation({ summary: 'Consulta um caixa com o resumo do período' })
  obter(@Param('id', ParseIntPipe) id: number) {
    return this.caixa.obter(id);
  }

  @RequerPermissao('caixa.operar')
  @Auditar('caixa.abrir', 'caixa')
  @Post('abrir')
  @ApiOperation({ summary: 'Abre o caixa do terminal (409 se já houver um aberto)' })
  abrir(@Body() dto: AbrirCaixaDto, @UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.caixa.abrir(dto, usuario);
  }

  @RequerPermissao('caixa.operar')
  @Auditar('caixa.fechar', 'caixa')
  @Post('fechar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Fecha o caixa e grava o total recebido em mv_fechamento' })
  fechar(@Body() dto: FecharCaixaDto) {
    return this.caixa.fechar(dto);
  }
}
