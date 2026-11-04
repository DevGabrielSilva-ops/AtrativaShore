import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AdicionarLimiteCarne1762300000004 implements MigrationInterface {
  name = 'AdicionarLimiteCarne1762300000004';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (await this.colunaExiste(queryRunner)) return;
    await queryRunner.query('ALTER TABLE cad_clientes ADD COLUMN limite_carne DECIMAL(10,2) NULL DEFAULT NULL');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await this.colunaExiste(queryRunner))) return;
    await queryRunner.query('ALTER TABLE cad_clientes DROP COLUMN limite_carne');
  }

  private async colunaExiste(queryRunner: QueryRunner): Promise<boolean> {
    const linhas = (await queryRunner.query(
      "SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cad_clientes' AND COLUMN_NAME = 'limite_carne'",
    )) as unknown[];
    return linhas.length > 0;
  }
}
