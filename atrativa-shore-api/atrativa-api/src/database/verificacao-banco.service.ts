import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CONEXAO_PLATAFORMA } from '../auth/sessao-usuario.service.js';
import { fonteDaEmpresa } from '../tenancy/contexto.js';

export interface EstadoBanco {
  tabelasMyisam: string[];
  credencialCriada: boolean;
  colunaPixCriada: boolean;
  colunaLimiteCarneCriada: boolean;
  tabelasCarneCriadas: boolean;
}

const TABELAS_TRANSACIONAIS = [
  'cad_produtos',
  'mv_estoque',
  'mv_estoque_historico',
  'mv_vendas',
  'mv_vendas_movimento',
  'mv_financeiro',
];

@Injectable()
export class VerificacaoBancoService implements OnApplicationBootstrap {
  private readonly logger = new Logger('Banco');
  private readonly transacoesOk = new Set<string>();

  constructor(@InjectDataSource(CONEXAO_PLATAFORMA) private readonly plataforma: DataSource) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      const pendentes = await this.migrationsPlataformaPendentes();
      if (pendentes) {
        this.logger.warn('Banco da plataforma sem as tabelas: execute "npm run plataforma:migrar".');
      }
    } catch (erro) {
      this.logger.error(`Não foi possível verificar o banco da plataforma: ${(erro as Error).message}`);
    }
  }

  async migrationsPlataformaPendentes(): Promise<boolean> {
    return this.plataforma.showMigrations();
  }

  async verificar(fonte: DataSource = fonteDaEmpresa()): Promise<EstadoBanco> {
    const motores = (await fonte.query(
      `SELECT TABLE_NAME AS tabela, ENGINE AS motor FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (?)`,
      [TABELAS_TRANSACIONAIS],
    )) as Array<{ tabela: string; motor: string }>;
    const existe = async (sql: string) => ((await fonte.query(sql)) as unknown[]).length > 0;
    return {
      tabelasMyisam: motores.filter((linha) => linha.motor?.toLowerCase() !== 'innodb').map((linha) => linha.tabela),
      credencialCriada: await existe(
        "SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'api_credencial'",
      ),
      colunaPixCriada: await existe(
        "SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'mv_vendas' AND COLUMN_NAME = 'vr_pix'",
      ),
      colunaLimiteCarneCriada: await existe(
        "SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cad_clientes' AND COLUMN_NAME = 'limite_carne'",
      ),
      tabelasCarneCriadas:
        (
          (await fonte.query(
            "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('api_recebimentos_carne', 'api_config_carne')",
          )) as unknown[]
        ).length === 2,
    };
  }

  async garantirTabelasCarne(): Promise<void> {
    const fonte = fonteDaEmpresa();
    const banco = `${String(fonte.options.database)}|carne`;
    if (this.transacoesOk.has(banco)) return;
    if (!(await this.verificar(fonte)).tabelasCarneCriadas) {
      throw new ServiceUnavailableException(
        'As tabelas de recebimento e juros do carnê ainda não foram criadas. Execute "npm run empresas:migrar".',
      );
    }
    this.transacoesOk.add(banco);
  }

  async garantirTransacoes(): Promise<void> {
    const fonte = fonteDaEmpresa();
    const banco = String(fonte.options.database);
    if (this.transacoesOk.has(banco)) return;
    const estado = await this.verificar(fonte);
    if (estado.tabelasMyisam.length > 0) {
      throw new ServiceUnavailableException(
        `Operação bloqueada: as tabelas ${estado.tabelasMyisam.join(', ')} ainda estão em MyISAM ` +
          'e não suportam transação. Execute "npm run empresas:migrar".',
      );
    }
    this.transacoesOk.add(banco);
  }
}
