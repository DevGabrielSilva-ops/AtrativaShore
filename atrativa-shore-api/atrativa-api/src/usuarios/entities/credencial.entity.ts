import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('api_credencial')
export class Credencial {
  @PrimaryColumn({ name: 'id_login', type: 'int', unsigned: true })
  idLogin: number;

  @Column({ name: 'senha_hash', type: 'varchar', length: 100 })
  senhaHash: string;

  @Column({ name: 'criado_em', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  criadoEm: Date;

  @Column({ name: 'atualizado_em', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  atualizadoEm: Date;
}
