import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adiciona mv_vendas.vr_pix (o banco legado não tem forma de pagamento Pix).
 *
 * ATENÇÃO, compatibilidade com o desktop: se o sistema desktop grava vendas
 * com "INSERT INTO mv_vendas VALUES (...)" sem lista de colunas, uma coluna
 * a mais faz esse INSERT falhar. Teste uma venda no desktop logo após rodar
 * esta migration; se falhar, reverta com `npm run migration:revert`.
 *
 * Reverter remove a coluna e os valores de Pix gravados nela.
 */
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
