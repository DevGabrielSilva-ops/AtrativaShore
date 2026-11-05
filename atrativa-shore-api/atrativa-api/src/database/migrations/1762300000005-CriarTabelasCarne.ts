import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CriarTabelasCarne1762300000005 implements MigrationInterface {
  name = 'CriarTabelasCarne1762300000005';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS api_recebimentos_carne (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      controle VARCHAR(14) NOT NULL,
      data_recebimento DATE NOT NULL,
      terminal CHAR(2) NULL,
      turno CHAR(1) NULL,
      id_login INT UNSIGNED NULL,
      vr_total DECIMAL(10,2) NOT NULL,
      vr_dinheiro DECIMAL(10,2) NOT NULL DEFAULT 0,
      vr_pix DECIMAL(10,2) NOT NULL DEFAULT 0,
      vr_cartao DECIMAL(10,2) NOT NULL DEFAULT 0,
      vr_recebido_dinheiro DECIMAL(10,2) NULL,
      vr_troco DECIMAL(10,2) NOT NULL DEFAULT 0,
      parcelas VARCHAR(700) NOT NULL,
      criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY ux_recebimentos_carne_controle (controle),
      KEY ix_recebimentos_carne_terminal_data (terminal, data_recebimento)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS api_config_carne (
      id TINYINT UNSIGNED NOT NULL DEFAULT 1,
      juros_dia DECIMAL(6,3) NOT NULL DEFAULT 0,
      multa DECIMAL(6,2) NOT NULL DEFAULT 0,
      carencia_dias SMALLINT UNSIGNED NOT NULL DEFAULT 0,
      atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS api_config_carne');
    await queryRunner.query('DROP TABLE IF EXISTS api_recebimentos_carne');
  }
}
