import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type StatusImportacao = 'ANALISANDO' | 'PRONTO' | 'PROCESSANDO' | 'CONCLUIDO' | 'FALHOU' | 'CANCELADO' | 'EXPIRADO';

@Entity('plataforma_importacoes')
@Index(['idEmpresa', 'criadoEm'])
export class Importacao {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'id_empresa', type: 'int', unsigned: true })
  idEmpresa: number;

  @Column({ type: 'varchar', length: 12, default: 'ANALISANDO' })
  status: StatusImportacao;

  @Column({ type: 'varchar', length: 20, nullable: true })
  origem: string | null;

  @Column({ name: 'nome_arquivo', type: 'varchar', length: 200 })
  nomeArquivo: string;

  @Column({ type: 'varchar', length: 255, nullable: true, select: false })
  caminho?: string | null;

  @Column({ type: 'bigint', unsigned: true, nullable: true })
  tamanho: string | null;

  @Column({ type: 'char', length: 64, nullable: true })
  sha256: string | null;

  @Column({ type: 'json', nullable: true })
  analise: Record<string, unknown> | null;

  @Column({ type: 'json', nullable: true })
  resultado: Record<string, unknown> | null;

  @Column({ type: 'tinyint', unsigned: true, default: 0 })
  progresso: number;

  @Column({ type: 'varchar', length: 120, nullable: true })
  etapa: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  erro: string | null;

  @Column({ name: 'id_backup_origem', type: 'int', unsigned: true, nullable: true })
  idBackupOrigem: number | null;

  @Column({ name: 'id_backup_seguranca', type: 'int', unsigned: true, nullable: true })
  idBackupSeguranca: number | null;

  @Column({ name: 'criado_por', type: 'int', unsigned: true })
  criadoPor: number;

  @CreateDateColumn({ name: 'criado_em', type: 'datetime' })
  criadoEm: Date;

  @Column({ name: 'confirmado_por', type: 'int', unsigned: true, nullable: true })
  confirmadoPor: number | null;

  @Column({ name: 'confirmado_em', type: 'datetime', nullable: true })
  confirmadoEm: Date | null;

  @Column({ name: 'concluido_em', type: 'datetime', nullable: true })
  concluidoEm: Date | null;
}
