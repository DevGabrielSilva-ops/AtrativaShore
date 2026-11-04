import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Publico } from '../common/decorators/publico.decorator.js';
import { AtivacaoService } from './ativacao.service.js';
import { ConcluirAtivacaoDto, ValidarCodigoDto } from './dto/ativacao.dto.js';

@ApiTags('Ativação')
@Controller('ativacao')
export class AtivacaoController {
  constructor(private readonly ativacao: AtivacaoService) {}

  @Publico()
  @Post('validar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confere um código de ativação sem consumi-lo' })
  validar(@Body() dto: ValidarCodigoDto) {
    return this.ativacao.validar(dto.codigo);
  }

  @Publico()
  @Post('concluir')
  @ApiOperation({
    summary: 'Consome o código e cria o administrador (e a empresa, para códigos de nova empresa)',
    description: '404 código inválido, 410 expirado ou revogado, 409 já utilizado ou e-mail em uso.',
  })
  concluir(@Body() dto: ConcluirAtivacaoDto) {
    return this.ativacao.concluir(dto);
  }
}
