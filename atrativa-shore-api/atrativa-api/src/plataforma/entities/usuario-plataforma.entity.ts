import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { Papel, StatusUsuario } from './papeis.js';

@Entity('plataforma_usuarios')
export class PlataformaUsuario {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Index()
  @Column({ name: 'id_empresa', type: 'int', unsigned: true, nullable: true })
  idEmpresa: number | null;

  @Column({ type: 'varchar', length: 100 })
  nome: string;

  @Column({ type: 'varchar', length: 200, nullable: true, unique: true })
  email: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true, unique: true })
  login: string | null;

  @Column({ name: 'senha_hash', type: 'varchar', length: 100, nullable: true, select: false })
  senhaHash?: string | null;

  @Column({ type: 'varchar', length: 20 })
  papel: Papel;

  @Column({ name: 'id_cargo', type: 'int', unsigned: true, nullable: true })
  idCargo: number | null;

  @Column({ type: 'varchar', length: 10, default: 'ACTIVE' })
  status: StatusUsuario;

  @Column({ name: 'trocar_senha', type: 'boolean', default: false })
  trocarSenha: boolean;

  @Column({ name: 'versao_token', type: 'int', unsigned: true, default: 1 })
  versaoToken: number;

  @Column({ name: 'id_login_legado', type: 'int', unsigned: true, nullable: true })
  idLoginLegado: number | null;

  @Column({ name: 'ultimo_login_em', type: 'datetime', nullable: true })
  ultimoLoginEm: Date | null;

  @CreateDateColumn({ name: 'criado_em', type: 'datetime' })
  criadoEm: Date;

  @UpdateDateColumn({ name: 'atualizado_em', type: 'datetime' })
  atualizadoEm: Date;

  @Column({ name: 'criado_por', type: 'int', unsigned: true, nullable: true })
  criadoPor: number | null;
}
