import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CriarApiCredencial1762300000002 implements MigrationInterface {
  name = 'CriarApiCredencial1762300000002';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS api_credencial (
        id_login INT UNSIGNED NOT NULL,
        senha_hash VARCHAR(100) NOT NULL,
        criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id_login)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS api_credencial');
  }
}
