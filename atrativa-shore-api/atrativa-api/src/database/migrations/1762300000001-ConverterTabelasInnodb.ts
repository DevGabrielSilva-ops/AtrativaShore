import type { MigrationInterface, QueryRunner } from 'typeorm';

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
