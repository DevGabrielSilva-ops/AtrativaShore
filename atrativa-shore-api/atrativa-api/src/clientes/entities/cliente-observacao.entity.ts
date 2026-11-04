import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('cad_clientes_obs')
export class ClienteObservacao {
  @PrimaryGeneratedColumn({ name: 'id', type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'id_cliente', type: 'int', unsigned: true, default: 0 })
  idCliente: number;

  @Column({ name: 'observacoes', type: 'text', nullable: true })
  observacoes: string | null;

  @Column({ name: 'foto', type: 'blob', nullable: true, select: false })
  foto?: Buffer | null;
}
