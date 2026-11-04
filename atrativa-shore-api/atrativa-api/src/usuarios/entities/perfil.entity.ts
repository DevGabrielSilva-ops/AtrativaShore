import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** cad_login_perfil — perfis de acesso. */
@Entity('cad_login_perfil')
export class Perfil {
  @PrimaryGeneratedColumn({ name: 'id_perfil', type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'nome_perfil', type: 'varchar', length: 30, nullable: true, unique: true })
  nome: string | null;

  /** 250 flags S/N por item de menu do desktop. Sem mapa de significado no banco. */
  @Column({ name: 'menu_options', type: 'varchar', length: 250, nullable: true, select: false })
  opcoesMenu?: string | null;
}
