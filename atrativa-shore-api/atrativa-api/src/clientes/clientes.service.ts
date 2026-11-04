import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, type Repository } from 'typeorm';
import { offset, paginado, type Paginado } from '../common/dto/paginacao.dto.js';
import { codigoBarrasCliente } from '../common/utils/codigos.js';
import { dataIsoValida } from '../common/utils/datas.js';
import { somenteDigitos } from '../common/utils/documentos.js';
import type { AtualizarClienteDto, CriarClienteDto, ListarClientesDto } from './dto/cliente.dto.js';
import { ClienteObservacao } from './entities/cliente-observacao.entity.js';
import { Cliente } from './entities/cliente.entity.js';

/** Expressão SQL que remove a máscara do CPF gravado (o legado tem CPFs com e sem máscara). */
const CPF_SEM_MASCARA = "REPLACE(REPLACE(REPLACE(REPLACE(c.cpf, '.', ''), '-', ''), '/', ''), ' ', '')";

@Injectable()
export class ClientesService {
  constructor(
    @InjectRepository(Cliente) private readonly clientes: Repository<Cliente>,
    private readonly fonte: DataSource,
  ) {}

  async listar(filtro: ListarClientesDto): Promise<Paginado<Cliente>> {
    const consulta = this.clientes.createQueryBuilder('c').orderBy('c.nome', 'ASC').addOrderBy('c.id', 'ASC');

    if (filtro.busca) {
      const termo = filtro.busca;
      const digitos = somenteDigitos(termo);
      const condicoes = ['c.nome LIKE :nome'];
      const parametros: Record<string, unknown> = { nome: `%${termo}%` };
      if (digitos.length >= 3) {
        condicoes.push(`${CPF_SEM_MASCARA} LIKE :cpf`, 'c.codigo = :codigo');
        parametros.cpf = `${digitos}%`;
        parametros.codigo = digitos;
      }
      if (/^\d{1,8}$/.test(termo)) {
        condicoes.push('c.id = :id');
        parametros.id = Number(termo);
      }
      consulta.where(`(${condicoes.join(' OR ')})`, parametros);
    }

    const [dados, total] = await consulta
      .skip(offset(filtro))
      .take(filtro.limit)
      .getManyAndCount();
    return paginado(dados, total, filtro.page, filtro.limit);
  }

  async obter(id: number): Promise<Cliente> {
    const cliente = await this.clientes.findOne({ where: { id } });
    if (!cliente) throw new NotFoundException(`Cliente #${id} não encontrado`);
    return cliente;
  }

  async criar(dto: CriarClienteDto): Promise<Cliente> {
    const dados = this.normalizar(dto);
    if (dados.cpf) await this.garantirCpfUnico(dados.cpf);

    const id = await this.fonte.transaction(async (manager) => {
      const resultado = await manager.insert(Cliente, dados);
      const novoId = Number(resultado.identifiers[0].id);
      // Mesmo padrão de código do desktop: "1" + id + dígito EAN-13.
      await manager.update(Cliente, { id: novoId }, { codigo: codigoBarrasCliente(novoId) });
      return novoId;
    });
    return this.obter(id);
  }

  async atualizar(id: number, dto: AtualizarClienteDto): Promise<Cliente> {
    await this.obter(id);
    const dados = this.normalizar(dto);
    if (dados.cpf) await this.garantirCpfUnico(dados.cpf, id);
    if (Object.keys(dados).length > 0) {
      await this.clientes.update({ id }, dados);
    }
    return this.obter(id);
  }

  /**
   * O banco não tem chaves estrangeiras, então a regra fica aqui: cliente
   * com vendas ou carnês não pode ser excluído (o histórico ficaria órfão).
   */
  async remover(id: number): Promise<void> {
    await this.obter(id);
    const [vinculos] = (await this.fonte.query(
      `SELECT
         EXISTS(SELECT 1 FROM mv_vendas WHERE id_cliente = ?) AS vendas,
         EXISTS(SELECT 1 FROM mv_vendas_movimento WHERE id_cliente = ?) AS itens,
         EXISTS(SELECT 1 FROM mv_financeiro WHERE id_cliente = ? AND origem_lancamento IN ('V', 'C')) AS financeiro`,
      [id, id, id],
    )) as Array<{ vendas: number | string; itens: number | string; financeiro: number | string }>;

    if (Number(vinculos.vendas) || Number(vinculos.itens) || Number(vinculos.financeiro)) {
      throw new ConflictException(
        'Cliente possui vendas ou carnês registrados e não pode ser excluído',
      );
    }

    await this.fonte.transaction(async (manager) => {
      await manager.delete(ClienteObservacao, { idCliente: id });
      await manager.delete(Cliente, { id });
    });
  }

  private async garantirCpfUnico(cpf: string, ignorarId?: number): Promise<void> {
    const consulta = this.clientes
      .createQueryBuilder('c')
      .select('c.id')
      .where(`${CPF_SEM_MASCARA} = :cpf`, { cpf });
    if (ignorarId) consulta.andWhere('c.id <> :id', { id: ignorarId });
    const existente = await consulta.getOne();
    if (existente) {
      throw new ConflictException(`Já existe um cliente com este CPF/CNPJ (cliente #${existente.id})`);
    }
  }

  private normalizar(dto: CriarClienteDto | AtualizarClienteDto): Partial<Cliente> {
    if (dto.dataAniversario && !dataIsoValida(dto.dataAniversario)) {
      throw new BadRequestException('dataAniversario não é uma data válida');
    }
    const dados: Partial<Cliente> = { ...dto };
    if (dto.cpf !== undefined) dados.cpf = somenteDigitos(dto.cpf) || null;
    return dados;
  }
}
