import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Converte para InnoDB as tabelas envolvidas em vendas e estoque.
 * MyISAM ignora START TRANSACTION/ROLLBACK, então sem esta conversão uma
 * venda que falha no meio pode ficar gravada sem baixar o estoque.
 *
 * - Não altera colunas nem dados; só o mecanismo de armazenamento.
 * - Idempotente: tabelas já em InnoDB são puladas.
 * - Reversível: `npm run migration:revert` volta para MyISAM.
 * - FAÇA BACKUP antes (mysqldump). Em tabelas grandes o ALTER bloqueia
 *   a tabela enquanto roda; execute fora do horário da loja.
 */
export class ConverterTabelasInnodb1762300000001 implements MigrationInterface {
  name = 'ConverterTabelasInnodb1762300000001';

  private readonly tabelas = [
    'cad_produtos',
    'mv_estoque',
    'mv_estoque_historico',
    'mv_vendas',
    'mv_vendas_movimento',
    'mv_financeiro',
  ];

  async up(queryRunner: QueryRunner): Promise<void> {
    await this.converter(queryRunner, 'InnoDB');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await this.converter(queryRunner, 'MyISAM');
  }

  private async converter(queryRunner: QueryRunner, motor: 'InnoDB' | 'MyISAM'): Promise<void> {
    const [{ modo }] = (await queryRunner.query('SELECT @@SESSION.sql_mode AS modo')) as Array<{
      modo: string;
    }>;
    // Os defaults legados ('0000-00-00', FLOAT(M,D)) são rejeitados em modo estrito
    // durante a reconstrução da tabela; o modo original é restaurado ao final.
    await queryRunner.query("SET SESSION sql_mode = ''");
    try {
      for (const tabela of this.tabelas) {
        const linhas = (await queryRunner.query(
          'SELECT ENGINE AS motor FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
          [tabela],
        )) as Array<{ motor: string }>;
        if (linhas.length === 0) {
          throw new Error(`Tabela ${tabela} não encontrada no banco`);
        }
        if (linhas[0].motor.toLowerCase() === motor.toLowerCase()) continue;
        await queryRunner.query(`ALTER TABLE \`${tabela}\` ENGINE=${motor}`);
      }
    } finally {
      await queryRunner.query('SET SESSION sql_mode = ?', [modo]);
    }
  }
}
