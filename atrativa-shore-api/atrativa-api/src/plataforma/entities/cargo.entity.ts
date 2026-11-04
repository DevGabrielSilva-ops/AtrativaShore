import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import type { PapelEmpresa } from './papeis.js';

@Entity('plataforma_cargos')
@Index(['idEmpresa', 'nome'], { unique: true })
export class Cargo {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'id_empresa', type: 'int', unsigned: true })
  idEmpresa: number;

  @Column({ type: 'varchar', length: 60 })
  nome: string;

  @Column({ name: 'papel_base', type: 'varchar', length: 20 })
  papelBase: PapelEmpresa;

  @Column({ type: 'json' })
  permissoes: string[];

  @CreateDateColumn({ name: 'criado_em', type: 'datetime' })
  criadoEm: Date;
}
