import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import {
  dataLegadaTransformer,
  dinheiroTransformer,
  quantidadeTransformer,
} from '../../common/utils/transformadores.js';

@Entity('mv_vendas_movimento')
export class VendaItem {
  @PrimaryGeneratedColumn({ name: 'id', type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'controle', type: 'varchar', length: 14, nullable: true })
  controle: string | null;

  @Column({ name: 'data_venda', type: 'date', nullable: true, transformer: dataLegadaTransformer })
  dataVenda: string | null;

  @Column({ name: 'id_login', type: 'int', unsigned: true, nullable: true })
  idLogin: number | null;

  @Column({ name: 'id_produto', type: 'int', unsigned: true, nullable: true })
  idProduto: number | null;

  @Column({ name: 'valor', type: 'float', precision: 10, scale: 2, nullable: true, transformer: dinheiroTransformer })
  valorUnitario: number | null;

  @Column({ name: 'quant', type: 'float', precision: 10, scale: 3, nullable: true, transformer: quantidadeTransformer })
  quantidade: number | null;

  @Column({ name: 'vr_total', type: 'float', precision: 10, scale: 2, nullable: true, transformer: dinheiroTransformer })
  valorTotal: number | null;

  @Column({ name: 'modo_venda', type: 'int', unsigned: true, nullable: true })
  modoVenda: number | null;

  @Column({ name: 'id_cliente', type: 'int', unsigned: true, nullable: true })
  idCliente: number | null;

  @Column({ name: 'estornado', type: 'int', unsigned: true, nullable: true, default: 0 })
  estornado: number | null;

  @Column({ name: 'terminal', type: 'char', length: 2, nullable: true })
  terminal: string | null;

  @Column({ name: 'turno', type: 'char', length: 1, nullable: true })
  turno: string | null;

  @Column({ name: 'modo_lancamento', type: 'tinyint', unsigned: true, default: 0 })
  modoLancamento: number;

  @Column({ name: 'id_grade', type: 'int', unsigned: true, default: 0 })
  idGrade: number;
}
