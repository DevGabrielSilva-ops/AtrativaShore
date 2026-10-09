import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity('cad_produtos')
export class Produtos {
    @PrimaryGeneratedColumn({
        name: 'id',
        type: 'int',
        unsigned: true,
    })
    id: number;

    @Column({
        name: 'nome_produto',
        type: 'varchar',
        length: 60
    })
    nome_produto: string;

    @Column({
        name: 'vr_compra',
        type: 'float',
        precision: 10,
        scale: 2
    })
    vr_compra: number;

    @Column({
        name: 'vr_venda',
        type: 'float',
        precision: 10,
        scale: 2
    })
    vr_venda: number;

    @Column({
        name: 'cod_barra',
        type: 'varchar',
        length: 30
    })
    cod_barra: string;

    @Column({
        name: 'inf_adicional',
        type: 'varchar',
        length: 30
    })
    inf_adicional: string;

    @Column({
        name: 'quantidade',
        type: 'float',
        precision: 10,
        scale: 2
    })
    quantidade: number;

    @Column({
        name: 'min_estoque',
        type: 'float',
        precision:10
    })
    min_estoque: number;


}