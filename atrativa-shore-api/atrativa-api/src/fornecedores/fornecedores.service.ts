import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Like, Not, type Repository } from 'typeorm';
import { offset, paginado, type Paginado } from '../common/dto/paginacao.dto.js';
import type {
  AtualizarFornecedorDto,
  CriarFornecedorDto,
  ListarFornecedoresDto,
} from './dto/fornecedor.dto.js';
import { Fornecedor } from './entities/fornecedor.entity.js';

@Injectable()
export class FornecedoresService {
  constructor(
    @InjectRepository(Fornecedor) private readonly fornecedores: Repository<Fornecedor>,
    private readonly fonte: DataSource,
  ) {}

  async listar(filtro: ListarFornecedoresDto): Promise<Paginado<Fornecedor>> {
    const [dados, total] = await this.fornecedores.findAndCount({
      where: filtro.busca ? { nome: Like(`%${filtro.busca}%`) } : {},
      order: { nome: 'ASC' },
      skip: offset(filtro),
      take: filtro.limit,
    });
    return paginado(dados, total, filtro.page, filtro.limit);
  }

  async obter(id: number): Promise<Fornecedor> {
    const fornecedor = await this.fornecedores.findOne({ where: { id } });
    if (!fornecedor) throw new NotFoundException(`Fornecedor #${id} não encontrado`);
    return fornecedor;
  }

  async criar(dto: CriarFornecedorDto): Promise<Fornecedor> {
    await this.garantirNomeUnico(dto.nome);
    const resultado = await this.fornecedores.insert(dto);
    return this.obter(Number(resultado.identifiers[0].id));
  }

  async atualizar(id: number, dto: AtualizarFornecedorDto): Promise<Fornecedor> {
    await this.obter(id);
    if (dto.nome) await this.garantirNomeUnico(dto.nome, id);
    if (Object.keys(dto).length > 0) await this.fornecedores.update({ id }, dto);
    return this.obter(id);
  }

  async remover(id: number): Promise<void> {
    await this.obter(id);
    const [vinculos] = (await this.fonte.query(
      `SELECT
         EXISTS(SELECT 1 FROM cad_produtos WHERE id_fornecedor = ?) AS produtos,
         EXISTS(SELECT 1 FROM mv_estoque_historico WHERE id_fornecedor = ?) AS entradas`,
      [id, id],
    )) as Array<{ produtos: number | string; entradas: number | string }>;
    if (Number(vinculos.produtos) || Number(vinculos.entradas)) {
      throw new ConflictException('Fornecedor possui produtos ou entradas de estoque e não pode ser excluído');
    }
    await this.fornecedores.delete({ id });
  }

  private async garantirNomeUnico(nome: string, ignorarId?: number): Promise<void> {
    const existente = await this.fornecedores.findOne({
      where: ignorarId ? { nome, id: Not(ignorarId) } : { nome },
    });
    if (existente) throw new ConflictException(`Já existe o fornecedor "${nome}" (#${existente.id})`);
  }
}
