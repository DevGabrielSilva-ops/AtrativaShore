import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('plataforma_auditoria')
@Index(['idEmpresa', 'dataHora'])
export class RegistroAuditoria {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: string;

  @CreateDateColumn({ name: 'data_hora', type: 'datetime' })
  dataHora: Date;

  @Index()
  @Column({ name: 'id_usuario', type: 'int', unsigned: true, nullable: true })
  idUsuario: number | null;

  @Column({ name: 'id_empresa', type: 'int', unsigned: true, nullable: true })
  idEmpresa: number | null;

  @Column({ type: 'varchar', length: 60 })
  acao: string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  entidade: string | null;

  @Column({ name: 'id_entidade', type: 'varchar', length: 40, nullable: true })
  idEntidade: string | null;

  @Column({ type: 'json', nullable: true })
  detalhes: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ip: string | null;
}
