import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface EstadoBanco {
  tabelasMyisam: string[];
  credencialCriada: boolean;
  colunaPixCriada: boolean;
}

const TABELAS_TRANSACIONAIS = [
  'cad_produtos',
  'mv_estoque',
  'mv_estoque_historico',
  'mv_vendas',
  'mv_vendas_movimento',
  'mv_financeiro',
];

/**
 * Na inicialização, confere se as migrations da API já foram aplicadas
 * e avisa no log. A API não altera o banco sozinha.
 */
@Injectable()
export class VerificacaoBancoService implements OnApplicationBootstrap {
  private readonly logger = new Logger('Banco');
  private estado: EstadoBanco | null = null;

  constructor(private readonly fonte: DataSource) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      const estado = await this.verificar();
      if (estado.tabelasMyisam.length > 0) {
        this.logger.warn(
          `Tabelas ainda em MyISAM (sem transação real): ${estado.tabelasMyisam.join(', ')}. ` +
            'Execute "npm run migration:run" após fazer backup.',
        );
      }
      if (!estado.credencialCriada) {
        this.logger.warn('Tabela api_credencial não existe: o login não funcionará até rodar as migrations.');
      }
      if (!estado.colunaPixCriada) {
        this.logger.warn('Coluna mv_vendas.vr_pix não existe: vendas e relatórios falharão até rodar as migrations.');
      }
    } catch (erro) {
      this.logger.error(`Não foi possível verificar o banco: ${(erro as Error).message}`);
    }
  }

  async verificar(): Promise<EstadoBanco> {
    const motores = (await this.fonte.query(
      `SELECT TABLE_NAME AS tabela, ENGINE AS motor FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (?)`,
      [TABELAS_TRANSACIONAIS],
    )) as Array<{ tabela: string; motor: string }>;
    const credencial = (await this.fonte.query(
      "SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'api_credencial'",
    )) as unknown[];
    const pix = (await this.fonte.query(
      "SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'mv_vendas' AND COLUMN_NAME = 'vr_pix'",
    )) as unknown[];

    this.estado = {
      tabelasMyisam: motores
        .filter((linha) => linha.motor?.toLowerCase() !== 'innodb')
        .map((linha) => linha.tabela),
      credencialCriada: credencial.length > 0,
      colunaPixCriada: pix.length > 0,
    };
    return this.estado;
  }

  /**
   * Garante que as tabelas de venda/estoque já estão em InnoDB antes de uma
   * operação que depende de rollback. Se ainda não estiverem, verifica de
   * novo (a migration pode ter sido aplicada com a API rodando) e, se
   * continuarem em MyISAM, recusa a operação em vez de arriscar dados
   * inconsistentes.
   */
  async garantirTransacoes(): Promise<void> {
    if (this.estado && this.estado.tabelasMyisam.length === 0) return;
    const estado = await this.verificar();
    if (estado.tabelasMyisam.length > 0) {
      throw new ServiceUnavailableException(
        `Operação bloqueada: as tabelas ${estado.tabelasMyisam.join(', ')} ainda estão em MyISAM ` +
          'e não suportam transação. Execute as migrations da API (npm run migration:run).',
      );
    }
  }
}
