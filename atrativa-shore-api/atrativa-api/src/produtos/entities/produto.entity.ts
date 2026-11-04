import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { dinheiroTransformer, numeroCasas } from '../../common/utils/transformadores.js';

/**
 * cad_produtos.
 * Preços: vr_venda = preço A PRAZO; vr_venda_2 = preço À VISTA
 * (confirmado pela tela de produtos e pelo nome dos produtos, ex.: "FRONHA IBI 14,99").
 */
@Entity('cad_produtos')
export class Produto {
  @PrimaryGeneratedColumn({ name: 'id', type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'nome_produto', type: 'varchar', length: 60, nullable: true, unique: true })
  nome: string | null;

  @Column({ name: 'cod_barra', type: 'varchar', length: 20, nullable: true })
  codigoBarras: string | null;

  @Column({ name: 'vr_compra', type: 'float', precision: 10, scale: 2, nullable: true, transformer: dinheiroTransformer })
  valorCompra: number | null;

  @Column({ name: 'vr_venda', type: 'float', precision: 10, scale: 2, nullable: true, transformer: dinheiroTransformer })
  precoPrazo: number | null;

  @Column({ name: 'vr_venda_2', type: 'float', precision: 10, scale: 2, nullable: true, transformer: dinheiroTransformer })
  precoVista: number | null;

  /** 1 = controla estoque; 6 = item de serviço (recebimento de carnê). */
  @Column({ name: 'modo_estoque', type: 'int', unsigned: true, nullable: true })
  modoEstoque: number | null;

  @Column({ name: 'id_tipo', type: 'int', unsigned: true, nullable: true })
  idTipo: number | null;

  @Column({ name: 'id_fornecedor', type: 'int', unsigned: true, nullable: true })
  idFornecedor: number | null;

  @Column({ name: 'min_estoque', type: 'float', nullable: true, transformer: numeroCasas(3) })
  estoqueMinimo: number | null;

  @Column({ name: 'unidade', type: 'char', length: 3, nullable: true })
  unidade: string | null;

  @Column({ name: 'inf_adicional', type: 'varchar', length: 30, nullable: true })
  informacoesAdicionais: string | null;

  @Column({ name: 'impostos', type: 'float', precision: 8, scale: 2, nullable: true, transformer: dinheiroTransformer })
  impostos: number | null;

  @Column({ name: 'ipi', type: 'float', nullable: true })
  ipi: number | null;

  @Column({ name: 'base_icms', type: 'float', nullable: true })
  baseIcms: number | null;

  @Column({ name: 'inside_icms_ipi', type: 'int', nullable: true })
  incideIcmsIpi: number | null;

  @Column({ name: 'situacao_trib', type: 'char', length: 3, nullable: true })
  situacaoTributaria: string | null;

  @Column({ name: 'id_class_fiscal', type: 'int', nullable: true })
  idClassificacaoFiscal: number | null;

  @Column({ name: 'grade', type: 'tinyint', unsigned: true, default: 0 })
  grade: number;
}
