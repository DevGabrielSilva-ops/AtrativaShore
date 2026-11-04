import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('plataforma_planos')
export class Plano {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ type: 'varchar', length: 60, unique: true })
  nome: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  descricao: string | null;

  @Column({ name: 'max_funcionarios', type: 'int', unsigned: true, nullable: true })
  maxFuncionarios: number | null;

  @Column({ type: 'boolean', default: true })
  ativo: boolean;

  @CreateDateColumn({ name: 'criado_em', type: 'datetime' })
  criadoEm: Date;
}
