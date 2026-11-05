import { Controller, Get, Header, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Query, StreamableFile } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import { RequerPermissao, SomentePlataforma } from '../acesso/acesso.decorators.js';
import type { UsuarioAutenticado } from '../auth/usuario-autenticado.js';
import { UsuarioAtual } from '../common/decorators/usuario-atual.decorator.js';
import { PaginacaoDto } from '../common/dto/paginacao.dto.js';
import { BackupsService, type ArquivoParaDownload } from './backups.service.js';
import { ImportacoesService } from './importacoes.service.js';

export function arquivoZip(arquivo: ArquivoParaDownload): StreamableFile {
  const ascii = arquivo.nome.replace(/[^A-Za-z0-9._-]/g, '_');
  return new StreamableFile(arquivo.stream, {
    type: 'application/zip',
    length: arquivo.tamanho,
    disposition: `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(arquivo.nome)}`,
  });
}

@ApiTags('Backups')
@ApiBearerAuth()
@RequerPermissao('backup.gerar')
@Controller('backups')
export class BackupsController {
  constructor(
    private readonly backups: BackupsService,
    private readonly importacoes: ImportacoesService,
  ) {}

  @Post(':id/restaurar')
  @RequerPermissao('backup.restaurar')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Prepara a restauração de um backup do histórico (gera a análise; nada é alterado até confirmar)' })
  restaurar(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('id', ParseIntPipe) id: number) {
    return this.importacoes.deBackup(usuario, id);
  }

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Inicia a geração do backup dos dados da empresa autenticada' })
  gerar(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.backups.gerarDaEmpresa(usuario);
  }

  @Get()
  @ApiOperation({ summary: 'Histórico de backups da empresa' })
  listar(@UsuarioAtual() usuario: UsuarioAutenticado, @Query() paginacao: PaginacaoDto) {
    return this.backups.listar(this.backups.escopoDaEmpresa(usuario), paginacao);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Situação e progresso de um backup' })
  obter(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('id', ParseIntPipe) id: number) {
    return this.backups.obter(this.backups.escopoDaEmpresa(usuario), id);
  }

  @Get(':id/download')
  @Header('Cache-Control', 'no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  @ApiProduces('application/zip')
  @ApiOperation({ summary: 'Baixa o arquivo ZIP do backup' })
  async baixar(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('id', ParseIntPipe) id: number) {
    return arquivoZip(await this.backups.abrirDownload(this.backups.escopoDaEmpresa(usuario), id, usuario));
  }
}

@ApiTags('Plataforma')
@ApiBearerAuth()
@SomentePlataforma()
@Controller('plataforma/backups')
export class BackupsPlataformaController {
  constructor(private readonly backups: BackupsService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Inicia o backup completo da plataforma (todas as empresas e o banco central)' })
  gerar(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.backups.gerarDaPlataforma(usuario);
  }

  @Get()
  @ApiOperation({ summary: 'Histórico de backups globais' })
  listar(@Query() paginacao: PaginacaoDto) {
    return this.backups.listar(this.backups.escopoPlataforma, paginacao);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Situação e progresso de um backup global' })
  obter(@Param('id', ParseIntPipe) id: number) {
    return this.backups.obter(this.backups.escopoPlataforma, id);
  }

  @Get(':id/download')
  @Header('Cache-Control', 'no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  @ApiProduces('application/zip')
  @ApiOperation({ summary: 'Baixa o arquivo ZIP do backup global' })
  async baixar(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('id', ParseIntPipe) id: number) {
    return arquivoZip(await this.backups.abrirDownload(this.backups.escopoPlataforma, id, usuario));
  }
}
