import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Publico } from '../common/decorators/publico.decorator.js';
import { VerificacaoBancoService } from '../database/verificacao-banco.service.js';

@ApiTags('Saúde')
@Controller('health')
export class SaudeController {
  constructor(private readonly banco: VerificacaoBancoService) {}

  @Publico()
  @Get()
  @ApiOperation({ summary: 'Verifica se a API e o banco estão no ar e se as migrations foram aplicadas' })
  async verificar() {
    try {
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
    } catch {
      throw new ServiceUnavailableException('Banco de dados indisponível');
    }
  }
}
