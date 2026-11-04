import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('plataforma_ativacoes')
export class Ativacao {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'id_codigo', type: 'int', unsigned: true })
  idCodigo: number;

  @Column({ name: 'id_empresa', type: 'int', unsigned: true })
  idEmpresa: number;

  @Column({ name: 'id_usuario', type: 'int', unsigned: true })
  idUsuario: number;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ip: string | null;

  @CreateDateColumn({ name: 'data_hora', type: 'datetime' })
  dataHora: Date;
}
