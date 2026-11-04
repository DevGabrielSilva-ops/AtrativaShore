import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SomenteAdministrador } from '../common/decorators/administrador.decorator.js';
import { AtualizarEmpresaDto } from './dto/atualizar-empresa.dto.js';
import { EmpresaService } from './empresa.service.js';

@ApiTags('Empresa')
@ApiBearerAuth()
@Controller('empresa')
export class EmpresaController {
  constructor(private readonly empresa: EmpresaService) {}

  @Get()
  @ApiOperation({ summary: 'Dados da empresa' })
  obter() {
    return this.empresa.obter();
  }

  @Patch()
  @SomenteAdministrador()
  @ApiOperation({ summary: 'Atualiza os dados cadastrais da empresa (somente administrador)' })
  atualizar(@Body() dto: AtualizarEmpresaDto) {
    return this.empresa.atualizar(dto);
  }
}
