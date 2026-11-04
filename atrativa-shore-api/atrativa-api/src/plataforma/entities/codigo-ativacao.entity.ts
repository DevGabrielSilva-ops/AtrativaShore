import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import type { TipoCodigo } from './papeis.js';

@Entity('plataforma_codigos_ativacao')
export class CodigoAtivacao {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ type: 'char', length: 64, unique: true, select: false })
  hash?: string;

  @Column({ type: 'varchar', length: 12 })
  prefixo: string;

  @Column({ type: 'varchar', length: 20 })
  tipo: TipoCodigo;

  @Column({ name: 'id_empresa', type: 'int', unsigned: true, nullable: true })
  idEmpresa: number | null;

  @Column({ name: 'email_destinatario', type: 'varchar', length: 200, nullable: true })
  emailDestinatario: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  observacao: string | null;

  @Column({ name: 'max_usos', type: 'int', unsigned: true, default: 1 })
  maxUsos: number;

  @Column({ type: 'int', unsigned: true, default: 0 })
  usos: number;

  @Column({ name: 'expira_em', type: 'datetime' })
  expiraEm: Date;

  @Column({ name: 'revogado_em', type: 'datetime', nullable: true })
  revogadoEm: Date | null;

  @Column({ name: 'ultimo_uso_em', type: 'datetime', nullable: true })
  ultimoUsoEm: Date | null;

  @Column({ name: 'criado_por', type: 'int', unsigned: true })
  criadoPor: number;

  @CreateDateColumn({ name: 'criado_em', type: 'datetime' })
  criadoEm: Date;
}
