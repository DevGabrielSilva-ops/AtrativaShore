import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SomenteAdministrador } from '../common/decorators/administrador.decorator.js';
import { UsuariosService } from './usuarios.service.js';

@ApiTags('Usuários')
@ApiBearerAuth()
@SomenteAdministrador()
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuarios: UsuariosService) {}

  @Get()
  @ApiOperation({ summary: 'Lista os usuários (sem senha)' })
  listar() {
    return this.usuarios.listar();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consulta um usuário' })
  obter(@Param('id', ParseIntPipe) id: number) {
    return this.usuarios.obter(id);
  }
}
