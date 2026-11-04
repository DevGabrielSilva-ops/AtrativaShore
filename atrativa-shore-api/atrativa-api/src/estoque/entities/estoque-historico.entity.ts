import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import {
  dataLegadaTransformer,
  dinheiroTransformer,
  quantidadeTransformer,
} from '../../common/utils/transformadores.js';

/**
 * mv_estoque_historico — lançamentos de estoque.
 * No legado só há entradas (notas e itens recebidos em troca). A API também
 * grava ajustes manuais, com numerodanota "AJ-<MOTIVO>" e quantidade
 * negativa quando é saída.
 */
@Entity('mv_estoque_historico')
export class EstoqueHistorico {
  @PrimaryGeneratedColumn({ name: 'id', type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'controle', type: 'varchar', length: 14, nullable: true })
  controle: string | null;

  @Column({ name: 'data_lanca', type: 'date', nullable: true, transformer: dataLegadaTransformer })
  dataLancamento: string | null;

  @Column({ name: 'id_produto', type: 'int', unsigned: true, nullable: true })
  idProduto: number | null;

  @Column({ name: 'quantidade', type: 'float', precision: 10, scale: 3, nullable: true, transformer: quantidadeTransformer })
  quantidade: number | null;

  @Column({ name: 'numerodanota', type: 'varchar', length: 15, nullable: true })
  numeroNota: string | null;

  @Column({ name: 'terminal', type: 'char', length: 2, nullable: true })
  terminal: string | null;

  @Column({ name: 'vr_compra', type: 'float', precision: 10, scale: 2, nullable: true, transformer: dinheiroTransformer })
  valorCompra: number | null;

  /** Controle da venda quando o item entrou por troca. */
  @Column({ name: 'controle_venda', type: 'varchar', length: 14, nullable: true })
  controleVenda: string | null;

  @Column({ name: 'estornado', type: 'int', unsigned: true, nullable: true, default: 0 })
  estornado: number | null;

  @Column({ name: 'id_fornecedor', type: 'int', unsigned: true, nullable: true })
  idFornecedor: number | null;

  @Column({ name: 'turno', type: 'char', length: 1, nullable: true })
  turno: string | null;
}
