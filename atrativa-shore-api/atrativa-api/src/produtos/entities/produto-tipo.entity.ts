import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** cad_produtos_tipo — categorias de produto. */
@Entity('cad_produtos_tipo')
export class ProdutoTipo {
  @PrimaryGeneratedColumn({ name: 'id', type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'nome_tipo', type: 'varchar', length: 30, nullable: true, unique: true })
  nome: string | null;
}
