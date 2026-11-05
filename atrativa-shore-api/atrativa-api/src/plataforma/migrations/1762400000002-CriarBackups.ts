import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CriarBackups1762400000002 implements MigrationInterface {
  name = 'CriarBackups1762400000002';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE plataforma_backups (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      tipo VARCHAR(12) NOT NULL,
      id_empresa INT UNSIGNED NULL,
      status VARCHAR(12) NOT NULL DEFAULT 'PROCESSANDO',
      progresso TINYINT UNSIGNED NOT NULL DEFAULT 0,
      etapa VARCHAR(120) NULL,
      nome_arquivo VARCHAR(160) NOT NULL,
      caminho VARCHAR(255) NULL,
      tamanho BIGINT UNSIGNED NULL,
      sha256 CHAR(64) NULL,
      registros INT UNSIGNED NULL,
      erro VARCHAR(255) NULL,
      criado_por INT UNSIGNED NOT NULL,
      criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      concluido_em DATETIME NULL,
      expira_em DATETIME NULL,
      downloads INT UNSIGNED NOT NULL DEFAULT 0,
      ultimo_download_em DATETIME NULL,
      PRIMARY KEY (id),
      KEY ix_backups_tipo_empresa (tipo, id_empresa, criado_em),
      CONSTRAINT fk_backups_empresa FOREIGN KEY (id_empresa) REFERENCES plataforma_empresas (id),
      CONSTRAINT fk_backups_usuario FOREIGN KEY (criado_por) REFERENCES plataforma_usuarios (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS plataforma_backups');
  }
}
