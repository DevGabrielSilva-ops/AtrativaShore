import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity('cad_clientes')
export class Cliente {
    @PrimaryGeneratedColumn({
        name: 'id',
        type: 'int',
        unsigned: true,
    })
    id: number;

    @Column({
        name: 'nome_cliente',
        type: 'varchar',
        length: 60,
    })
    nome_cliente: string;

    @Column({
        name: 'endereco',
        type: 'varchar',
        length: 130,
    })
    endereco: string;

    @Column({
        name: 'bairro',
        type: 'varchar',
        length: 130
    })
    bairro: string;

    @Column({
        name: 'cidade',
        type: 'varchar',
        length: 100
    })
    cidade: string;

    @Column({
        name: 'uf',
        type: 'varchar',
        length: 20
    })
    uf: string;

    @Column({
        name: 'telefone',
        type: 'varchar',
        length: 30,
        nullable: true
    })
    telefone: string | null;

    @Column({
        name: 'celular',
        type: 'varchar',
        length: 30
    })
    celular: string;

    @Column({
        name: 'email',
        type: 'varchar',
        length: 60,
        nullable: true
    })
    email: string | null;

    @Column({
        name: 'cpf',
        type: 'varchar',
        length: 11
    })
    cpf: string;

    @Column({
        name: 'cep',
        type: 'varchar',
        length: 20
    })
    cep: string;

    @Column({
        name: 'cod_barra',
        type: 'varchar',
        length: 100,
        nullable: true
    })
    cod_barra: string | null;

    @Column({
        name: 'dataniver',
        type: 'date',
    })
    dataniver: Date;

    @Column({
        name: 'rg',
        type: 'varchar',
        length: 9
    })
    rg: string;

    @Column({
        name: 'inf_adicional',
        type: 'varchar',
        length: 200,
        nullable: true
    })
    inf_adicional: string | null;

    @Column({
        name: 'faixasalarial',
        type: 'float',
        precision: 10,
        scale: 2,
    })
    faixasalarial: number;

    @Column({
        name: 'ie',
        type: 'varchar',
        length: 200,
        nullable: true
    })
    ie: string | null;

}