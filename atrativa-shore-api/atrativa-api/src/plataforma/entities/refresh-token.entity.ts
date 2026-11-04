import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('plataforma_refresh_tokens')
export class RefreshToken {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Index()
  @Column({ name: 'id_usuario', type: 'int', unsigned: true })
  idUsuario: number;

  @Column({ type: 'char', length: 64, unique: true })
  hash: string;

  @Column({ type: 'boolean', default: false })
  persistente: boolean;

  @Column({ name: 'expira_em', type: 'datetime' })
  expiraEm: Date;

  @Column({ name: 'revogado_em', type: 'datetime', nullable: true })
  revogadoEm: Date | null;

  @Column({ name: 'substituido_por', type: 'int', unsigned: true, nullable: true })
  substituidoPor: number | null;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ip: string | null;

  @Column({ name: 'user_agent', type: 'varchar', length: 255, nullable: true })
  userAgent: string | null;

  @CreateDateColumn({ name: 'criado_em', type: 'datetime' })
  criadoEm: Date;
}
