import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Publico } from '../common/decorators/publico.decorator.js';
import { VerificacaoBancoService } from '../database/verificacao-banco.service.js';

@ApiTags('Saúde')
@Controller()
export class SaudeController {
  constructor(private readonly banco: VerificacaoBancoService) {}

  @Publico()
  @Get('health')
  @ApiOperation({ summary: 'Verifica se a API e o banco da plataforma estão no ar' })
  async verificar() {
    try {
      const pendentes = await this.banco.migrationsPlataformaPendentes();
      return { status: 'ok', banco: 'conectado', plataformaMigrada: !pendentes };
    } catch {
      throw new ServiceUnavailableException('Banco de dados indisponível');
    }
  }

  @ApiBearerAuth()
  @Get('empresa/estado-banco')
  @ApiOperation({ summary: 'Migrations aplicadas no banco da empresa do usuário' })
  async estadoEmpresa() {
    const estado = await this.banco.verificar();
    return {
      status: 'ok',
      banco: 'conectado',
      migrations: {
        tabelasInnodb: estado.tabelasMyisam.length === 0,
        tabelasAindaMyisam: estado.tabelasMyisam,
        apiCredencial: estado.credencialCriada,
        colunaVrPix: estado.colunaPixCriada,
        colunaLimiteCarne: estado.colunaLimiteCarneCriada,
      },
    };
  }
}
