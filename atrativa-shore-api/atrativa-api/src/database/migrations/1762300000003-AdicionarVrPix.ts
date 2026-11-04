import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AdicionarVrPix1762300000003 implements MigrationInterface {
  name = 'AdicionarVrPix1762300000003';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (await this.colunaExiste(queryRunner)) return;
    await queryRunner.query(
      'ALTER TABLE mv_vendas ADD COLUMN vr_pix DECIMAL(10,2) NULL DEFAULT 0.00 AFTER vr_ticket',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await this.colunaExiste(queryRunner))) return;
    await queryRunner.query('ALTER TABLE mv_vendas DROP COLUMN vr_pix');
  }

  private async colunaExiste(queryRunner: QueryRunner): Promise<boolean> {
    const linhas = (await queryRunner.query(
      "SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'mv_vendas' AND COLUMN_NAME = 'vr_pix'",
    )) as unknown[];
    return linhas.length > 0;
  }
}
