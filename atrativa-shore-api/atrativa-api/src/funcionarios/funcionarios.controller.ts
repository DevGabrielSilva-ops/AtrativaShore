import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequerPermissao } from '../acesso/acesso.decorators.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { ListarAuditoriaDto } from '../auditoria/dto/auditoria.dto.js';
import type { UsuarioAutenticado } from '../auth/usuario-autenticado.js';
import { UsuarioAtual } from '../common/decorators/usuario-atual.decorator.js';
import {
  AlterarStatusDto,
  AtualizarFuncionarioDto,
  CargoDto,
  CriarFuncionarioDto,
  ListarFuncionariosDto,
} from './dto/funcionario.dto.js';
import { FuncionariosService } from './funcionarios.service.js';

@ApiTags('Funcionários')
@ApiBearerAuth()
@Controller('funcionarios')
export class FuncionariosController {
  constructor(
    private readonly funcionarios: FuncionariosService,
    private readonly auditoria: AuditoriaService,
  ) {}

  @Get('catalogo')
  @RequerPermissao('funcionarios.consultar')
  @ApiOperation({ summary: 'Papéis disponíveis e catálogo de permissões' })
  catalogo() {
    return this.funcionarios.catalogo();
  }

  @Get()
  @RequerPermissao('funcionarios.consultar')
  @ApiOperation({ summary: 'Funcionários da empresa' })
  listar(@UsuarioAtual() usuario: UsuarioAutenticado, @Query() filtro: ListarFuncionariosDto) {
    return this.funcionarios.listar(usuario.idEmpresa!, filtro);
  }

  @Get(':id')
  @RequerPermissao('funcionarios.consultar')
  @ApiOperation({ summary: 'Consulta um funcionário' })
  obter(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('id', ParseIntPipe) id: number) {
    return this.funcionarios.obter(usuario.idEmpresa!, id);
  }

  @Get(':id/atividades')
  @RequerPermissao('funcionarios.consultar', 'auditoria.consultar')
  @ApiOperation({ summary: 'Histórico de atividades do funcionário' })
  async atividades(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @Query() filtro: ListarAuditoriaDto,
  ) {
    await this.funcionarios.obter(usuario.idEmpresa!, id);
    return this.auditoria.listar({ ...filtro, idEmpresa: usuario.idEmpresa!, idUsuario: id });
  }

  @Post()
  @RequerPermissao('funcionarios.gerenciar')
  @ApiOperation({ summary: 'Cadastra um funcionário; devolve a senha temporária uma única vez' })
  criar(@UsuarioAtual() usuario: UsuarioAutenticado, @Body() dto: CriarFuncionarioDto) {
    return this.funcionarios.criar(usuario, dto);
  }

  @Patch(':id')
  @RequerPermissao('funcionarios.gerenciar')
  @ApiOperation({ summary: 'Atualiza dados, papel ou cargo de um funcionário' })
  atualizar(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AtualizarFuncionarioDto,
  ) {
    return this.funcionarios.atualizar(usuario, id, dto);
  }

  @Post(':id/status')
  @HttpCode(HttpStatus.OK)
  @RequerPermissao('funcionarios.gerenciar')
  @ApiOperation({ summary: 'Ativa ou desativa o acesso de um funcionário' })
  alterarStatus(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AlterarStatusDto,
  ) {
    return this.funcionarios.alterarStatus(usuario, id, dto.status);
  }

  @Post(':id/senha-temporaria')
  @HttpCode(HttpStatus.OK)
  @RequerPermissao('funcionarios.gerenciar')
  @ApiOperation({ summary: 'Gera uma senha temporária; o funcionário troca no próximo acesso' })
  redefinirSenha(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('id', ParseIntPipe) id: number) {
    return this.funcionarios.redefinirSenha(usuario, id);
  }
}

@ApiTags('Funcionários')
@ApiBearerAuth()
@Controller('cargos')
export class CargosController {
  constructor(private readonly funcionarios: FuncionariosService) {}

  @Get()
  @RequerPermissao('funcionarios.consultar')
  @ApiOperation({ summary: 'Cargos personalizados da empresa' })
  listar(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.funcionarios.listarCargos(usuario.idEmpresa!);
  }

  @Post()
  @RequerPermissao('funcionarios.gerenciar')
  @ApiOperation({ summary: 'Cria um cargo com permissões personalizadas' })
  criar(@UsuarioAtual() usuario: UsuarioAutenticado, @Body() dto: CargoDto) {
    return this.funcionarios.criarCargo(usuario, dto);
  }

  @Patch(':id')
  @RequerPermissao('funcionarios.gerenciar')
  @ApiOperation({ summary: 'Altera um cargo; encerra as sessões de quem o usa' })
  atualizar(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('id', ParseIntPipe) id: number, @Body() dto: CargoDto) {
    return this.funcionarios.atualizarCargo(usuario, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequerPermissao('funcionarios.gerenciar')
  @ApiOperation({ summary: 'Exclui um cargo sem funcionários' })
  async remover(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('id', ParseIntPipe) id: number) {
    await this.funcionarios.removerCargo(usuario, id);
  }
}
