import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { Equals, IsString } from 'class-validator';
import { RequerPermissao } from '../acesso/acesso.decorators.js';
import type { UsuarioAutenticado } from '../auth/usuario-autenticado.js';
import { UsuarioAtual } from '../common/decorators/usuario-atual.decorator.js';
import { PaginacaoDto } from '../common/dto/paginacao.dto.js';
import { ImportacoesService, type ArquivoRecebido } from './importacoes.service.js';

export const PALAVRA_DE_CONFIRMACAO = 'SUBSTITUIR';

export class ConfirmarImportacaoDto {
  @ApiProperty({ example: PALAVRA_DE_CONFIRMACAO, description: 'Digite SUBSTITUIR para confirmar a troca dos dados' })
  @IsString()
  @Equals(PALAVRA_DE_CONFIRMACAO, { message: `Digite ${PALAVRA_DE_CONFIRMACAO} para confirmar` })
  confirmacao: string;
}

@ApiTags('Backups')
@ApiBearerAuth()
@RequerPermissao('backup.restaurar')
@Controller('importacoes')
export class ImportacoesController {
  constructor(private readonly importacoes: ImportacoesService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @UseInterceptors(FileInterceptor('arquivo'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { arquivo: { type: 'string', format: 'binary' } } } })
  @ApiOperation({ summary: 'Envia um backup (.zip do Atrativa Shore ou dump .sql) para análise, sem alterar dados' })
  enviar(@UsuarioAtual() usuario: UsuarioAutenticado, @UploadedFile() arquivo: ArquivoRecebido | undefined) {
    return this.importacoes.receber(usuario, arquivo);
  }

  @Get()
  @ApiOperation({ summary: 'Importações da empresa' })
  listar(@UsuarioAtual() usuario: UsuarioAutenticado, @Query() paginacao: PaginacaoDto) {
    return this.importacoes.listar(usuario.idEmpresa!, paginacao);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Análise, progresso e resultado de uma importação' })
  obter(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('id', ParseIntPipe) id: number) {
    return this.importacoes.obter(usuario.idEmpresa!, id);
  }

  @Post(':id/confirmar')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Gera um backup de segurança e substitui os dados da empresa pelos do arquivo' })
  confirmar(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('id', ParseIntPipe) id: number, @Body() _dto: ConfirmarImportacaoDto) {
    return this.importacoes.confirmar(usuario, id);
  }

  @Post(':id/cancelar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Descarta uma importação analisada e o arquivo enviado' })
  cancelar(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('id', ParseIntPipe) id: number) {
    return this.importacoes.cancelar(usuario, id);
  }

  @Get(':id/senhas')
  @ApiOperation({ summary: 'Senhas temporárias dos funcionários criados na importação (exibidas uma única vez)' })
  senhas(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('id', ParseIntPipe) id: number) {
    return this.importacoes.retirarSenhas(usuario.idEmpresa!, id);
  }
}
