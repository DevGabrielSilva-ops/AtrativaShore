import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('cad_login_perfil')
export class Perfil {
  @PrimaryGeneratedColumn({ name: 'id_perfil', type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'nome_perfil', type: 'varchar', length: 30, nullable: true, unique: true })
  nome: string | null;

  @Column({ name: 'menu_options', type: 'varchar', length: 250, nullable: true, select: false })
  opcoesMenu?: string | null;
}
