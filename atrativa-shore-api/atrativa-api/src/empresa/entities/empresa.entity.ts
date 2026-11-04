import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { numeroCasas } from '../../common/utils/transformadores.js';

@Entity('cad_empresa')
export class Empresa {
  @PrimaryGeneratedColumn({ name: 'id', type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'nome_empresa', type: 'varchar', length: 100, nullable: true })
  nome: string | null;

  @Column({ name: 'endereco', type: 'varchar', length: 100, nullable: true })
  endereco: string | null;

  @Column({ name: 'bairro', type: 'varchar', length: 200, nullable: true })
  bairro: string | null;

  @Column({ name: 'cidade', type: 'varchar', length: 30, nullable: true })
  cidade: string | null;

  @Column({ name: 'uf', type: 'char', length: 2, nullable: true })
  uf: string | null;

  @Column({ name: 'cep', type: 'varchar', length: 15, nullable: true })
  cep: string | null;

  @Column({ name: 'cnpj', type: 'varchar', length: 18, nullable: true })
  cnpj: string | null;

  @Column({ name: 'ie', type: 'varchar', length: 16, nullable: true })
  ie: string | null;

  @Column({ name: 'im', type: 'varchar', length: 20, nullable: true })
  im: string | null;

  @Column({ name: 'telefone', type: 'varchar', length: 15, nullable: true })
  telefone: string | null;

  @Column({ name: 'fax', type: 'varchar', length: 15, nullable: true })
  fax: string | null;

  @Column({ name: 'email', type: 'varchar', length: 200, nullable: true })
  email: string | null;

  @Column({ name: 'site', type: 'varchar', length: 200, nullable: true })
  site: string | null;

  @Column({ name: 'mensagem', type: 'varchar', length: 200, nullable: true })
  mensagem: string | null;

  @Column({ name: 'qtd_terminal', type: 'int', unsigned: true, nullable: true })
  qtdTerminal: number | null;

  @Column({ name: 'qtd_turnos', type: 'char', length: 1, default: '1' })
  qtdTurnos: string;

  @Column({ name: 'max_desc', type: 'float', nullable: true, transformer: numeroCasas(2) })
  maxDesconto: number | null;

  @Column({ name: 'fracionado', type: 'tinyint', nullable: true })
  fracionado: number | null;

  @Column({ name: 'chave_liberacao', type: 'varchar', length: 21, nullable: true, select: false })
  chaveLiberacao?: string | null;

  @Column({ name: 'foto', type: 'blob', nullable: true, select: false })
  foto?: Buffer | null;
}
