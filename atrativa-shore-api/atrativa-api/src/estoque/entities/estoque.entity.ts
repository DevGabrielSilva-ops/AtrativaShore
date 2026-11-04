import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { quantidadeTransformer } from '../../common/utils/transformadores.js';

/** mv_estoque — saldo atual, uma linha por produto (UNIQUE id_produto). */
@Entity('mv_estoque')
export class Estoque {
  @PrimaryGeneratedColumn({ name: 'id', type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'id_produto', type: 'int', unsigned: true, nullable: true, unique: true })
  idProduto: number | null;

  @Column({ name: 'quantidade', type: 'float', precision: 10, scale: 3, nullable: true, transformer: quantidadeTransformer })
  quantidade: number | null;

  @Column({ name: 'modo_estoque', type: 'int', unsigned: true, nullable: true })
  modoEstoque: number | null;
}
