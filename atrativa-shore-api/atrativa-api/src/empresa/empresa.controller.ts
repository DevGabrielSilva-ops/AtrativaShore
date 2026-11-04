import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { RequerPermissao } from '../acesso/acesso.decorators.js';
import { Auditar } from '../auditoria/auditar.decorator.js';
import { CONEXAO_PLATAFORMA } from '../auth/sessao-usuario.service.js';
import type { UsuarioAutenticado } from '../auth/usuario-autenticado.js';
import { UsuarioAtual } from '../common/decorators/usuario-atual.decorator.js';
import { PlataformaEmpresa } from '../plataforma/entities/index.js';
import { AtualizarEmpresaDto } from './dto/atualizar-empresa.dto.js';
import { EmpresaService } from './empresa.service.js';

@ApiTags('Empresa')
@ApiBearerAuth()
@Controller('empresa')
export class EmpresaController {
  constructor(
    private readonly empresa: EmpresaService,
    @InjectRepository(PlataformaEmpresa, CONEXAO_PLATAFORMA) private readonly plataforma: Repository<PlataformaEmpresa>,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Dados da empresa' })
  obter() {
    return this.empresa.obter();
  }

  @RequerPermissao('empresa.configurar')
  @Auditar('empresa.atualizar', 'empresa')
  @Patch()
  @ApiOperation({ summary: 'Atualiza os dados cadastrais da empresa' })
  async atualizar(@Body() dto: AtualizarEmpresaDto, @UsuarioAtual() usuario: UsuarioAutenticado) {
    const atualizada = await this.empresa.atualizar(dto);
    await this.plataforma.update(
      { id: usuario.idEmpresa! },
      {
        nome: atualizada.nome ?? usuario.empresa!.nome,
        cnpj: atualizada.cnpj,
        email: atualizada.email,
        telefone: atualizada.telefone,
        cidade: atualizada.cidade,
        uf: atualizada.uf,
      },
    );
    return atualizada;
  }
}
