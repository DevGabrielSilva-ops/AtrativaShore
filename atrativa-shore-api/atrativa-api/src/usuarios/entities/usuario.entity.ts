import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('cad_login')
export class Usuario {
  @PrimaryGeneratedColumn({ name: 'id', type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'login', type: 'varchar', length: 15, nullable: true, unique: true })
  login: string | null;

  @Column({ name: 'senha', type: 'varchar', length: 6, nullable: true, select: false })
  senhaLegada?: string | null;

  @Column({ name: 'id_perfil', type: 'int', unsigned: true, default: 1 })
  idPerfil: number;

  @Column({ name: 'autoriza', type: 'char', length: 1, nullable: true })
  autoriza: string | null;
}
