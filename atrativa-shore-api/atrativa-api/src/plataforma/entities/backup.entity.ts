import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type TipoBackup = 'EMPRESA' | 'PLATAFORMA';
export type StatusBackup = 'PROCESSANDO' | 'CONCLUIDO' | 'FALHOU' | 'EXPIRADO';

@Entity('plataforma_backups')
@Index(['tipo', 'idEmpresa', 'criadoEm'])
export class Backup {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ type: 'varchar', length: 12 })
  tipo: TipoBackup;

  @Column({ name: 'id_empresa', type: 'int', unsigned: true, nullable: true })
  idEmpresa: number | null;

  @Column({ type: 'varchar', length: 12, default: 'PROCESSANDO' })
  status: StatusBackup;

  @Column({ type: 'tinyint', unsigned: true, default: 0 })
  progresso: number;

  @Column({ type: 'varchar', length: 120, nullable: true })
  etapa: string | null;

  @Column({ name: 'nome_arquivo', type: 'varchar', length: 160 })
  nomeArquivo: string;

  @Column({ type: 'varchar', length: 255, nullable: true, select: false })
  caminho?: string | null;

  @Column({ type: 'bigint', unsigned: true, nullable: true })
  tamanho: string | null;

  @Column({ type: 'char', length: 64, nullable: true })
  sha256: string | null;

  @Column({ type: 'int', unsigned: true, nullable: true })
  registros: number | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  erro: string | null;

  @Column({ name: 'criado_por', type: 'int', unsigned: true })
  criadoPor: number;

  @CreateDateColumn({ name: 'criado_em', type: 'datetime' })
  criadoEm: Date;

  @Column({ name: 'concluido_em', type: 'datetime', nullable: true })
  concluidoEm: Date | null;

  @Column({ name: 'expira_em', type: 'datetime', nullable: true })
  expiraEm: Date | null;

  @Column({ type: 'int', unsigned: true, default: 0 })
  downloads: number;

  @Column({ name: 'ultimo_download_em', type: 'datetime', nullable: true })
  ultimoDownloadEm: Date | null;
}
