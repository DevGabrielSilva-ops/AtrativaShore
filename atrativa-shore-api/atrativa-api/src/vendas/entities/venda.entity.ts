import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { dataLegadaTransformer, dinheiroTransformer } from '../../common/utils/transformadores.js';

@Entity('mv_vendas')
export class Venda {
  @PrimaryGeneratedColumn({ name: 'id', type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'controle', type: 'varchar', length: 14, nullable: true, unique: true })
  controle: string | null;

  @Column({ name: 'data_venda', type: 'date', nullable: true, transformer: dataLegadaTransformer })
  dataVenda: string | null;

  @Column({ name: 'id_cliente', type: 'int', unsigned: true, nullable: true, default: 0 })
  idCliente: number | null;

  @Column({ name: 'id_login', type: 'int', unsigned: true, nullable: true })
  idLogin: number | null;

  @Column({ name: 'vr_total', type: 'float', precision: 10, scale: 2, nullable: true, transformer: dinheiroTransformer })
  valorTotal: number | null;

  @Column({ name: 'vr_adicional', type: 'float', precision: 10, scale: 2, nullable: true, transformer: dinheiroTransformer })
  valorDesconto: number | null;

  @Column({ name: 'parcelas', type: 'int', unsigned: true, nullable: true })
  parcelas: number | null;

  @Column({ name: 'estornado', type: 'int', unsigned: true, nullable: true, default: 0 })
  estornado: number | null;

  @Column({ name: 'estornado_data', type: 'date', nullable: true, transformer: dataLegadaTransformer })
  dataEstorno: string | null;

  @Column({ name: 'vr_dinheiro', type: 'float', precision: 10, scale: 2, nullable: true, transformer: dinheiroTransformer })
  valorDinheiro: number | null;

  @Column({ name: 'vr_cheque', type: 'float', precision: 10, scale: 2, nullable: true, transformer: dinheiroTransformer })
  valorCheque: number | null;

  @Column({ name: 'vr_cartao', type: 'float', precision: 10, scale: 2, nullable: true, transformer: dinheiroTransformer })
  valorCartao: number | null;

  @Column({ name: 'vr_carne', type: 'float', precision: 10, scale: 2, nullable: true, transformer: dinheiroTransformer })
  valorCarne: number | null;

  @Column({ name: 'vr_ticket', type: 'float', precision: 10, scale: 2, nullable: true, transformer: dinheiroTransformer })
  valorTicket: number | null;

  @Column({ name: 'vr_pix', type: 'decimal', precision: 10, scale: 2, nullable: true, default: 0, transformer: dinheiroTransformer })
  valorPix: number | null;

  @Column({ name: 'terminal', type: 'char', length: 2, nullable: true })
  terminal: string | null;

  @Column({ name: 'turno', type: 'char', length: 1, nullable: true })
  turno: string | null;

  @Column({ name: 'id_cartao', type: 'tinyint', unsigned: true, nullable: true, default: 0 })
  idCartao: number | null;
}
