import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SomentePlataforma } from '../../acesso/acesso.decorators.js';
import { AuditoriaService } from '../../auditoria/auditoria.service.js';
import { ListarAuditoriaPlataformaDto } from '../../auditoria/dto/auditoria.dto.js';
import type { UsuarioAutenticado } from '../../auth/usuario-autenticado.js';
import { UsuarioAtual } from '../../common/decorators/usuario-atual.decorator.js';
import {
  AdministradorDto,
  AlterarStatusEmpresaDto,
  AtualizarEmpresaPlataformaDto,
  EmpresaPlataformaDto,
  GerarCodigoDto,
  ListarCodigosDto,
  ListarEmpresasDto,
  PlanoDto,
  StatusUsuarioDto,
} from './dto/plataforma.dto.js';
import { PlataformaService } from './plataforma.service.js';

@ApiTags('Plataforma')
@ApiBearerAuth()
@SomentePlataforma()
@Controller('plataforma')
export class PlataformaController {
  constructor(
    private readonly plataforma: PlataformaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  @Get('indicadores')
  @ApiOperation({ summary: 'Indicadores gerais da plataforma' })
  indicadores() {
    return this.plataforma.indicadores();
  }

  @Get('empresas')
  @ApiOperation({ summary: 'Empresas cadastradas, com status e quantidade de usuários' })
  listarEmpresas(@Query() filtro: ListarEmpresasDto) {
    return this.plataforma.listarEmpresas(filtro);
  }

  @Post('empresas')
  @ApiOperation({ summary: 'Cadastra uma empresa (fica PENDING até o responsável ativar)' })
  criarEmpresa(@UsuarioAtual() usuario: UsuarioAutenticado, @Body() dto: EmpresaPlataformaDto) {
    return this.plataforma.criarEmpresa(usuario, dto);
  }

  @Get('empresas/:id')
  @ApiOperation({ summary: 'Detalhes da empresa: administradores, funcionários por papel, ativações e códigos' })
  obterEmpresa(@Param('id', ParseIntPipe) id: number) {
    return this.plataforma.obterEmpresa(id);
  }

  @Patch('empresas/:id')
  @ApiOperation({ summary: 'Altera nome, plano ou fim da assinatura' })
  atualizarEmpresa(@Param('id', ParseIntPipe) id: number, @Body() dto: AtualizarEmpresaPlataformaDto) {
    return this.plataforma.atualizarEmpresa(id, dto);
  }

  @Post('empresas/:id/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ativa, reativa ou suspende uma empresa (os dados são preservados)' })
  alterarStatus(@Param('id', ParseIntPipe) id: number, @Body() dto: AlterarStatusEmpresaDto) {
    return this.plataforma.alterarStatus(id, dto);
  }

  @Post('empresas/:id/usuarios/:idUsuario/senha-temporaria')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Gera senha temporária para um usuário da empresa (ex.: administrador que perdeu o acesso)' })
  senhaTemporaria(@Param('id', ParseIntPipe) id: number, @Param('idUsuario', ParseIntPipe) idUsuario: number) {
    return this.plataforma.senhaTemporariaUsuario(id, idUsuario);
  }

  @Get('planos')
  @ApiOperation({ summary: 'Planos' })
  listarPlanos() {
    return this.plataforma.listarPlanos();
  }

  @Post('planos')
  @ApiOperation({ summary: 'Cria um plano (sem cobrança nesta etapa)' })
  criarPlano(@Body() dto: PlanoDto) {
    return this.plataforma.criarPlano(dto);
  }

  @Patch('planos/:id')
  @ApiOperation({ summary: 'Altera um plano' })
  atualizarPlano(@Param('id', ParseIntPipe) id: number, @Body() dto: PlanoDto) {
    return this.plataforma.atualizarPlano(id, dto);
  }

  @Get('codigos')
  @ApiOperation({ summary: 'Códigos de ativação (o código em si nunca é exibido de novo)' })
  listarCodigos(@Query() filtro: ListarCodigosDto) {
    return this.plataforma.listarCodigos(filtro);
  }

  @Post('codigos')
  @ApiOperation({ summary: 'Gera um código de ativação; o código completo aparece só nesta resposta' })
  gerarCodigo(@UsuarioAtual() usuario: UsuarioAutenticado, @Body() dto: GerarCodigoDto) {
    return this.plataforma.gerarCodigo(usuario, dto);
  }

  @Post('codigos/:id/revogar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoga um código de ativação' })
  revogarCodigo(@Param('id', ParseIntPipe) id: number) {
    return this.plataforma.revogarCodigo(id);
  }

  @Get('administradores')
  @ApiOperation({ summary: 'Superadministradores da plataforma' })
  listarAdministradores() {
    return this.plataforma.listarAdministradores();
  }

  @Post('administradores')
  @ApiOperation({ summary: 'Cria um superadministrador com senha temporária' })
  criarAdministrador(@UsuarioAtual() usuario: UsuarioAutenticado, @Body() dto: AdministradorDto) {
    return this.plataforma.criarAdministrador(usuario, dto);
  }

  @Post('administradores/:id/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ativa ou desativa um superadministrador' })
  statusAdministrador(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: StatusUsuarioDto,
  ) {
    return this.plataforma.alterarStatusAdministrador(usuario, id, dto.status);
  }

  @Post('administradores/:id/senha-temporaria')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Gera senha temporária para outro superadministrador' })
  senhaAdministrador(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('id', ParseIntPipe) id: number) {
    return this.plataforma.senhaTemporariaAdministrador(usuario, id);
  }

  @Get('auditoria')
  @ApiOperation({ summary: 'Histórico de atividades de toda a plataforma' })
  auditoriaGeral(@Query() filtro: ListarAuditoriaPlataformaDto) {
    return this.auditoria.listar(filtro);
  }
}
