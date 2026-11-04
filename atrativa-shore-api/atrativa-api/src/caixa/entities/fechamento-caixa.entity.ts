import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { dataLegadaTransformer, dinheiroTransformer } from '../../common/utils/transformadores.js';

/** mv_fechamento — abertura e fechamento de caixa por terminal e turno. */
@Entity('mv_fechamento')
export class FechamentoCaixa {
  @PrimaryGeneratedColumn({ name: 'id', type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'data_abertura', type: 'date', nullable: true, transformer: dataLegadaTransformer })
  dataAbertura: string | null;

  @Column({ name: 'hora_abertura', type: 'time', nullable: true })
  horaAbertura: string | null;

  @Column({ name: 'data_fechamento', type: 'date', nullable: true, transformer: dataLegadaTransformer })
  dataFechamento: string | null;

  @Column({ name: 'hora_fechamento', type: 'time', nullable: true })
  horaFechamento: string | null;

  @Column({ name: 'vr_abertura', type: 'float', precision: 10, scale: 2, nullable: true, transformer: dinheiroTransformer })
  valorAbertura: number | null;

  @Column({ name: 'vr_fechamento', type: 'float', precision: 10, scale: 2, nullable: true, transformer: dinheiroTransformer })
  valorFechamento: number | null;

  @Column({ name: 'id_login', type: 'int', unsigned: true, nullable: true })
  idLogin: number | null;

  @Column({ name: 'turno', type: 'char', length: 1, nullable: true })
  turno: string | null;

  @Column({ name: 'terminal', type: 'char', length: 2, nullable: true })
  terminal: string | null;

  /** 'F' = fechado; 'P' = aberto (inferido). */
  @Column({ name: 'status_caixa', type: 'char', length: 1, nullable: true })
  status: string | null;
}
