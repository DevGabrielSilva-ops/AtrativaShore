import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CriarImportacoes1762400000003 implements MigrationInterface {
  name = 'CriarImportacoes1762400000003';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE plataforma_importacoes (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      id_empresa INT UNSIGNED NOT NULL,
      status VARCHAR(12) NOT NULL DEFAULT 'ANALISANDO',
      origem VARCHAR(20) NULL,
      nome_arquivo VARCHAR(200) NOT NULL,
      caminho VARCHAR(255) NULL,
      tamanho BIGINT UNSIGNED NULL,
      sha256 CHAR(64) NULL,
      analise JSON NULL,
      resultado JSON NULL,
      progresso TINYINT UNSIGNED NOT NULL DEFAULT 0,
      etapa VARCHAR(120) NULL,
      erro VARCHAR(255) NULL,
      id_backup_origem INT UNSIGNED NULL,
      id_backup_seguranca INT UNSIGNED NULL,
      criado_por INT UNSIGNED NOT NULL,
      criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      confirmado_por INT UNSIGNED NULL,
      confirmado_em DATETIME NULL,
      concluido_em DATETIME NULL,
      PRIMARY KEY (id),
      KEY ix_importacoes_empresa (id_empresa, criado_em),
      CONSTRAINT fk_importacoes_empresa FOREIGN KEY (id_empresa) REFERENCES plataforma_empresas (id),
      CONSTRAINT fk_importacoes_usuario FOREIGN KEY (criado_por) REFERENCES plataforma_usuarios (id),
      CONSTRAINT fk_importacoes_backup_origem FOREIGN KEY (id_backup_origem) REFERENCES plataforma_backups (id),
      CONSTRAINT fk_importacoes_backup_seguranca FOREIGN KEY (id_backup_seguranca) REFERENCES plataforma_backups (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS plataforma_importacoes');
  }
}
