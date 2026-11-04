import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('cad_fornecedores')
export class Fornecedor {
  @PrimaryGeneratedColumn({ name: 'id', type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'nome_fornecedor', type: 'varchar', length: 60, nullable: true, unique: true })
  nome: string | null;

  @Column({ name: 'cnpj', type: 'varchar', length: 18, nullable: true })
  cnpj: string | null;

  @Column({ name: 'ie', type: 'varchar', length: 16, nullable: true })
  ie: string | null;

  @Column({ name: 'contato', type: 'varchar', length: 30, nullable: true })
  contato: string | null;

  @Column({ name: 'e_mail', type: 'varchar', length: 100, nullable: true })
  email: string | null;

  @Column({ name: 'telefone', type: 'varchar', length: 15, nullable: true })
  telefone: string | null;

  @Column({ name: 'fax', type: 'varchar', length: 15, nullable: true })
  fax: string | null;

  @Column({ name: 'rua', type: 'varchar', length: 50, nullable: true })
  rua: string | null;

  @Column({ name: 'cidade', type: 'varchar', length: 20, nullable: true })
  cidade: string | null;

  @Column({ name: 'uf', type: 'char', length: 2, nullable: true })
  uf: string | null;

  @Column({ name: 'cep', type: 'varchar', length: 15, nullable: true })
  cep: string | null;
}
