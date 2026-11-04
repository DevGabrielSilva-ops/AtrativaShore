import type { MigrationInterface, QueryRunner } from 'typeorm';

const OPCOES = 'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';

export class CriarPlataforma1762400000001 implements MigrationInterface {
  name = 'CriarPlataforma1762400000001';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE plataforma_planos (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      nome VARCHAR(60) NOT NULL,
      descricao VARCHAR(255) NULL,
      max_funcionarios INT UNSIGNED NULL,
      ativo TINYINT(1) NOT NULL DEFAULT 1,
      criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_planos_nome (nome)
    ) ${OPCOES}`);

    await queryRunner.query(`CREATE TABLE plataforma_empresas (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      nome VARCHAR(100) NOT NULL,
      cnpj VARCHAR(18) NULL,
      email VARCHAR(200) NULL,
      telefone VARCHAR(15) NULL,
      cidade VARCHAR(30) NULL,
      uf CHAR(2) NULL,
      status VARCHAR(12) NOT NULL DEFAULT 'PENDING',
      motivo_status VARCHAR(255) NULL,
      id_plano INT UNSIGNED NULL,
      banco VARCHAR(64) NOT NULL,
      banco_provisionado TINYINT(1) NOT NULL DEFAULT 0,
      assinatura_ate DATE NULL,
      criada_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      ativada_em DATETIME NULL,
      suspensa_em DATETIME NULL,
      criada_por INT UNSIGNED NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_empresas_banco (banco),
      KEY ix_empresas_status (status),
      CONSTRAINT fk_empresas_plano FOREIGN KEY (id_plano) REFERENCES plataforma_planos (id)
    ) ${OPCOES}`);

    await queryRunner.query(`CREATE TABLE plataforma_cargos (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      id_empresa INT UNSIGNED NOT NULL,
      nome VARCHAR(60) NOT NULL,
      papel_base VARCHAR(20) NOT NULL,
      permissoes JSON NOT NULL,
      criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_cargos_empresa_nome (id_empresa, nome),
      CONSTRAINT fk_cargos_empresa FOREIGN KEY (id_empresa) REFERENCES plataforma_empresas (id)
    ) ${OPCOES}`);

    await queryRunner.query(`CREATE TABLE plataforma_usuarios (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      id_empresa INT UNSIGNED NULL,
      nome VARCHAR(100) NOT NULL,
      email VARCHAR(200) NULL,
      login VARCHAR(40) NULL,
      senha_hash VARCHAR(100) NULL,
      papel VARCHAR(20) NOT NULL,
      id_cargo INT UNSIGNED NULL,
      status VARCHAR(10) NOT NULL DEFAULT 'ACTIVE',
      trocar_senha TINYINT(1) NOT NULL DEFAULT 0,
      versao_token INT UNSIGNED NOT NULL DEFAULT 1,
      id_login_legado INT UNSIGNED NULL,
      ultimo_login_em DATETIME NULL,
      criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      criado_por INT UNSIGNED NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_usuarios_email (email),
      UNIQUE KEY uq_usuarios_login (login),
      KEY ix_usuarios_empresa (id_empresa),
      CONSTRAINT fk_usuarios_empresa FOREIGN KEY (id_empresa) REFERENCES plataforma_empresas (id),
      CONSTRAINT fk_usuarios_cargo FOREIGN KEY (id_cargo) REFERENCES plataforma_cargos (id)
    ) ${OPCOES}`);

    await queryRunner.query(`CREATE TABLE plataforma_codigos_ativacao (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      hash CHAR(64) NOT NULL,
      prefixo VARCHAR(12) NOT NULL,
      tipo VARCHAR(20) NOT NULL,
      id_empresa INT UNSIGNED NULL,
      email_destinatario VARCHAR(200) NULL,
      observacao VARCHAR(255) NULL,
      max_usos INT UNSIGNED NOT NULL DEFAULT 1,
      usos INT UNSIGNED NOT NULL DEFAULT 0,
      expira_em DATETIME NOT NULL,
      revogado_em DATETIME NULL,
      ultimo_uso_em DATETIME NULL,
      criado_por INT UNSIGNED NOT NULL,
      criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_codigos_hash (hash),
      CONSTRAINT fk_codigos_empresa FOREIGN KEY (id_empresa) REFERENCES plataforma_empresas (id),
      CONSTRAINT fk_codigos_criador FOREIGN KEY (criado_por) REFERENCES plataforma_usuarios (id)
    ) ${OPCOES}`);

    await queryRunner.query(`CREATE TABLE plataforma_ativacoes (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      id_codigo INT UNSIGNED NOT NULL,
      id_empresa INT UNSIGNED NOT NULL,
      id_usuario INT UNSIGNED NOT NULL,
      ip VARCHAR(45) NULL,
      data_hora DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      CONSTRAINT fk_ativacoes_codigo FOREIGN KEY (id_codigo) REFERENCES plataforma_codigos_ativacao (id),
      CONSTRAINT fk_ativacoes_empresa FOREIGN KEY (id_empresa) REFERENCES plataforma_empresas (id),
      CONSTRAINT fk_ativacoes_usuario FOREIGN KEY (id_usuario) REFERENCES plataforma_usuarios (id)
    ) ${OPCOES}`);

    await queryRunner.query(`CREATE TABLE plataforma_refresh_tokens (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      id_usuario INT UNSIGNED NOT NULL,
      hash CHAR(64) NOT NULL,
      persistente TINYINT(1) NOT NULL DEFAULT 0,
      expira_em DATETIME NOT NULL,
      revogado_em DATETIME NULL,
      substituido_por INT UNSIGNED NULL,
      ip VARCHAR(45) NULL,
      user_agent VARCHAR(255) NULL,
      criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_refresh_hash (hash),
      KEY ix_refresh_usuario (id_usuario),
      CONSTRAINT fk_refresh_usuario FOREIGN KEY (id_usuario) REFERENCES plataforma_usuarios (id) ON DELETE CASCADE
    ) ${OPCOES}`);

    await queryRunner.query(`CREATE TABLE plataforma_auditoria (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      data_hora DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      id_usuario INT UNSIGNED NULL,
      id_empresa INT UNSIGNED NULL,
      acao VARCHAR(60) NOT NULL,
      entidade VARCHAR(40) NULL,
      id_entidade VARCHAR(40) NULL,
      detalhes JSON NULL,
      ip VARCHAR(45) NULL,
      PRIMARY KEY (id),
      KEY ix_auditoria_empresa_data (id_empresa, data_hora),
      KEY ix_auditoria_usuario (id_usuario),
      KEY ix_auditoria_acao (acao)
    ) ${OPCOES}`);

    await queryRunner.query(
      "INSERT INTO plataforma_planos (nome, descricao, max_funcionarios) VALUES ('Padrão', 'Plano inicial, sem limite de funcionários', NULL)",
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    for (const tabela of [
      'plataforma_auditoria',
      'plataforma_refresh_tokens',
      'plataforma_ativacoes',
      'plataforma_codigos_ativacao',
      'plataforma_usuarios',
      'plataforma_cargos',
      'plataforma_empresas',
      'plataforma_planos',
    ]) {
      await queryRunner.query(`DROP TABLE IF EXISTS ${tabela}`);
    }
  }
}
