import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adiciona cad_clientes.limite_carne: limite manual de compras no carnê.
 * NULL (padrão para todos os clientes existentes) = limite calculado pela
 * faixa salarial (CARNE_LIMITE_PERCENTUAL_RENDA) ou CARNE_LIMITE_PADRAO.
 *
 * ATENÇÃO, compatibilidade com o desktop: se o sistema desktop cadastra
 * clientes com "INSERT INTO cad_clientes VALUES (...)" sem lista de colunas,
 * uma coluna a mais faz esse INSERT falhar. Cadastre um cliente de teste no
 * desktop logo após rodar esta migration; se falhar, reverta com
 * `npm run migration:revert`.
 *
 * Reverter remove a coluna e os limites manuais gravados nela.
 */
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
