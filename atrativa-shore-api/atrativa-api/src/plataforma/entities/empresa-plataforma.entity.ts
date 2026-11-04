import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import type { StatusEmpresa } from './papeis.js';

@Entity('plataforma_empresas')
export class PlataformaEmpresa {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ type: 'varchar', length: 100 })
  nome: string;

  @Column({ type: 'varchar', length: 18, nullable: true })
  cnpj: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 15, nullable: true })
  telefone: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  cidade: string | null;

  @Column({ type: 'char', length: 2, nullable: true })
  uf: string | null;

  @Column({ type: 'varchar', length: 12, default: 'PENDING' })
  status: StatusEmpresa;

  @Column({ name: 'motivo_status', type: 'varchar', length: 255, nullable: true })
  motivoStatus: string | null;

  @Column({ name: 'id_plano', type: 'int', unsigned: true, nullable: true })
  idPlano: number | null;

  @Column({ type: 'varchar', length: 64, unique: true })
  banco: string;

  @Column({ name: 'banco_provisionado', type: 'boolean', default: false })
  bancoProvisionado: boolean;

  @Column({ name: 'assinatura_ate', type: 'date', nullable: true })
  assinaturaAte: string | null;

  @CreateDateColumn({ name: 'criada_em', type: 'datetime' })
  criadaEm: Date;

  @Column({ name: 'ativada_em', type: 'datetime', nullable: true })
  ativadaEm: Date | null;

  @Column({ name: 'suspensa_em', type: 'datetime', nullable: true })
  suspensaEm: Date | null;

  @Column({ name: 'criada_por', type: 'int', unsigned: true, nullable: true })
  criadaPor: number | null;
}
