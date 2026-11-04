import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequerPermissao } from '../acesso/acesso.decorators.js';
import type { UsuarioAutenticado } from '../auth/usuario-autenticado.js';
import { UsuarioAtual } from '../common/decorators/usuario-atual.decorator.js';
import { AuditoriaService } from './auditoria.service.js';
import { ListarAuditoriaDto } from './dto/auditoria.dto.js';

@ApiTags('Auditoria')
@ApiBearerAuth()
@Controller('auditoria')
export class AuditoriaController {
  constructor(private readonly auditoria: AuditoriaService) {}

  @Get()
  @RequerPermissao('auditoria.consultar')
  @ApiOperation({ summary: 'Histórico de atividades da empresa do usuário' })
  listar(@UsuarioAtual() usuario: UsuarioAutenticado, @Query() filtro: ListarAuditoriaDto) {
    return this.auditoria.listar({ ...filtro, idEmpresa: usuario.idEmpresa! });
  }
}
