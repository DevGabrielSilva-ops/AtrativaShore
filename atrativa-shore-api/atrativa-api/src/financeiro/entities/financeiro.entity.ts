import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { dataLegadaTransformer, dinheiroTransformer } from '../../common/utils/transformadores.js';

/**
 * mv_financeiro — contas a receber/pagar e lançamentos de caixa.
 * origem: V = venda à vista, C = parcela de carnê, E = entrada de mercadoria.
 */
@Entity('mv_financeiro')
export class Financeiro {
  @PrimaryGeneratedColumn({ name: 'id', type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'controle', type: 'varchar', length: 14, nullable: true })
  controle: string | null;

  @Column({ name: 'data_lancamento', type: 'date', nullable: true, transformer: dataLegadaTransformer })
  dataLancamento: string | null;

  @Column({ name: 'data_vencimento', type: 'date', nullable: true, transformer: dataLegadaTransformer })
  dataVencimento: string | null;

  @Column({ name: 'data_pagamento', type: 'date', nullable: true, transformer: dataLegadaTransformer })
  dataPagamento: string | null;

  @Column({ name: 'origem_lancamento', type: 'char', length: 1, nullable: true })
  origem: string | null;

  @Column({ name: 'tipo_lancamento', type: 'char', length: 1, default: 'E' })
  tipo: string;

  @Column({ name: 'parcela', type: 'int', unsigned: true, default: 1 })
  parcela: number;

  @Column({ name: 'vr_pago', type: 'float', precision: 10, scale: 2, nullable: true, transformer: dinheiroTransformer })
  valorPago: number | null;

  @Column({ name: 'id_cliente', type: 'int', unsigned: true, nullable: true })
  idCliente: number | null;

  @Column({ name: 'vr_desconto', type: 'float', precision: 10, scale: 2, nullable: true, transformer: dinheiroTransformer })
  valorDesconto: number | null;

  @Column({ name: 'vr_juros', type: 'float', precision: 10, scale: 2, nullable: true, transformer: dinheiroTransformer })
  valorJuros: number | null;

  @Column({ name: 'historico', type: 'varchar', length: 200, nullable: true })
  historico: string | null;

  @Column({ name: 'id_plano', type: 'int', unsigned: true, nullable: true })
  idPlano: number | null;

  @Column({ name: 'vr_parcela', type: 'float', precision: 10, scale: 2, nullable: true, transformer: dinheiroTransformer })
  valorParcela: number | null;

  @Column({ name: 'efetuado', type: 'char', length: 1, default: 'N' })
  efetuado: string;

  @Column({ name: 'documento', type: 'varchar', length: 15, nullable: true })
  documento: string | null;

  @Column({ name: 'cod_carne', type: 'varchar', length: 13, nullable: true })
  codigoCarne: string | null;

  @Column({ name: 'estornado', type: 'int', unsigned: true, nullable: true, default: 0 })
  estornado: number | null;

  @Column({ name: 'terminal', type: 'char', length: 2, nullable: true })
  terminal: string | null;

  @Column({ name: 'turno', type: 'char', length: 1, nullable: true })
  turno: string | null;
}
