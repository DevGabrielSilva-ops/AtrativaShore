import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** cad_login — usuários do sistema (compartilhado com o desktop legado). */
@Entity('cad_login')
export class Usuario {
  @PrimaryGeneratedColumn({ name: 'id', type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'login', type: 'varchar', length: 15, nullable: true, unique: true })
  login: string | null;

  /**
   * Senha do sistema legado, em TEXTO PURO (varchar 6). A API só a lê no
   * primeiro login de cada usuário, para gerar o hash bcrypt em api_credencial.
   * Nunca é selecionada por padrão nem retornada.
   */
  @Column({ name: 'senha', type: 'varchar', length: 6, nullable: true, select: false })
  senhaLegada?: string | null;

  @Column({ name: 'id_perfil', type: 'int', unsigned: true, default: 1 })
  idPerfil: number;

  /** Significado não documentado no legado (valor atual: 'S'). Apenas exibido. */
  @Column({ name: 'autoriza', type: 'char', length: 1, nullable: true })
  autoriza: string | null;
}
