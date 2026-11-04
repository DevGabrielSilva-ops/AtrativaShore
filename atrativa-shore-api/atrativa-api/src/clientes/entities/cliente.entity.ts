import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { dataLegadaTransformer, dinheiroTransformer, numeroCasas } from '../../common/utils/transformadores.js';

@Entity('cad_clientes')
export class Cliente {
  @PrimaryGeneratedColumn({ name: 'id', type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'nome_cliente', type: 'varchar', length: 60, nullable: true })
  nome: string | null;

  @Column({ name: 'cpf', type: 'varchar', length: 18, nullable: true })
  cpf: string | null;

  @Column({ name: 'rg', type: 'varchar', length: 16, nullable: true })
  rg: string | null;

  @Column({ name: 'ie', type: 'varchar', length: 16, nullable: true })
  ie: string | null;

  @Column({ name: 'telefone', type: 'varchar', length: 15, nullable: true })
  telefone: string | null;

  @Column({ name: 'celular', type: 'varchar', length: 15, nullable: true })
  celular: string | null;

  @Column({ name: 'email', type: 'varchar', length: 100, nullable: true })
  email: string | null;

  @Column({ name: 'endereco', type: 'varchar', length: 50, nullable: true })
  endereco: string | null;

  @Column({ name: 'bairro', type: 'varchar', length: 30, nullable: true })
  bairro: string | null;

  @Column({ name: 'cidade', type: 'varchar', length: 30, nullable: true })
  cidade: string | null;

  @Column({ name: 'uf', type: 'char', length: 2, nullable: true })
  uf: string | null;

  @Column({ name: 'cep', type: 'varchar', length: 15, nullable: true })
  cep: string | null;

  @Column({ name: 'cod_barra', type: 'varchar', length: 13, nullable: true })
  codigo: string | null;

  @Column({ name: 'dataniver', type: 'date', nullable: true, transformer: dataLegadaTransformer })
  dataAniversario: string | null;

  @Column({
    name: 'faixasalarial',
    type: 'float',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: numeroCasas(2),
  })
  faixaSalarial: number | null;

  @Column({ name: 'inf_adicional', type: 'varchar', length: 255, nullable: true })
  informacoesAdicionais: string | null;

  @Column({ name: 'limite_carne', type: 'decimal', precision: 10, scale: 2, nullable: true, transformer: dinheiroTransformer })
  limiteCarne: number | null;
}
