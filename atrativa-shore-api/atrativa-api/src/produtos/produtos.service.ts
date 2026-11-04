import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, type EntityManager, Not, type Repository } from 'typeorm';
import { ConfiguracaoService } from '../config/configuracao.service.js';
import { MODO_ESTOQUE } from '../common/constantes/legado.js';
import { offset, paginado, type Paginado } from '../common/dto/paginacao.dto.js';
import { codigoBarrasProduto } from '../common/utils/codigos.js';
import { arredondarCasas } from '../common/utils/dinheiro.js';
import { numeroOuNulo } from '../common/utils/transformadores.js';
import { Estoque } from '../estoque/entities/estoque.entity.js';
import { Fornecedor } from '../fornecedores/entities/fornecedor.entity.js';
import type {
  AtualizarProdutoDto,
  CriarProdutoDto,
  EstoqueBaixoDto,
  ListarProdutosDto,
} from './dto/produto.dto.js';
import { ProdutoTipo } from './entities/produto-tipo.entity.js';
import { Produto } from './entities/produto.entity.js';

export interface ProdutoResposta {
  id: number;
  nome: string | null;
  codigoBarras: string | null;
  valorCompra: number | null;
  precoVista: number | null;
  precoPrazo: number | null;
  lucroBrutoPercentual: number | null;
  estoqueMinimo: number | null;
  quantidadeEstoque: number | null;
  controlaEstoque: boolean;
  unidade: string | null;
  informacoesAdicionais: string | null;
  tipo: { id: number; nome: string | null } | null;
  fornecedor: { id: number; nome: string | null } | null;
}

interface LinhaProduto {
  id: number;
  nome_produto: string | null;
  cod_barra: string | null;
  vr_compra: number | string | null;
  vr_venda: number | string | null;
  vr_venda_2: number | string | null;
  min_estoque: number | string | null;
  modo_estoque: number | null;
  unidade: string | null;
  inf_adicional: string | null;
  id_tipo: number | null;
  nome_tipo: string | null;
  id_fornecedor: number | null;
  nome_fornecedor: string | null;
  quantidade: number | string | null;
}

const SELECT_PRODUTO = `
  SELECT p.id, p.nome_produto, p.cod_barra, p.vr_compra, p.vr_venda, p.vr_venda_2, p.min_estoque,
         p.modo_estoque, p.unidade, p.inf_adicional, p.id_tipo, t.nome_tipo,
         p.id_fornecedor, f.nome_fornecedor, e.quantidade
    FROM cad_produtos p
    LEFT JOIN mv_estoque e ON e.id_produto = p.id
    LEFT JOIN cad_produtos_tipo t ON t.id = p.id_tipo
    LEFT JOIN cad_fornecedores f ON f.id = p.id_fornecedor`;

export function lucroBruto(valorCompra: number | null, precoVista: number | null): number | null {
  if (!valorCompra || valorCompra <= 0 || !precoVista) return null;
  return arredondarCasas(((precoVista - valorCompra) / valorCompra) * 100, 2);
}

function paraResposta(linha: LinhaProduto): ProdutoResposta {
  const valorCompra = numeroOuNulo(linha.vr_compra);
  const precoVista = numeroOuNulo(linha.vr_venda_2);
  return {
    id: Number(linha.id),
    nome: linha.nome_produto,
    codigoBarras: linha.cod_barra,
    valorCompra,
    precoVista,
    precoPrazo: numeroOuNulo(linha.vr_venda),
    lucroBrutoPercentual: lucroBruto(valorCompra, precoVista),
    estoqueMinimo: numeroOuNulo(linha.min_estoque, 3),
    quantidadeEstoque: numeroOuNulo(linha.quantidade, 3),
    controlaEstoque: Number(linha.modo_estoque) === MODO_ESTOQUE.CONTROLA,
    unidade: linha.unidade,
    informacoesAdicionais: linha.inf_adicional,
    tipo: linha.id_tipo ? { id: Number(linha.id_tipo), nome: linha.nome_tipo } : null,
    fornecedor: linha.id_fornecedor
      ? { id: Number(linha.id_fornecedor), nome: linha.nome_fornecedor }
      : null,
  };
}

@Injectable()
export class ProdutosService {
  constructor(
    @InjectRepository(Produto) private readonly produtos: Repository<Produto>,
    @InjectRepository(ProdutoTipo) private readonly tipos: Repository<ProdutoTipo>,
    private readonly fonte: DataSource,
    private readonly config: ConfiguracaoService,
  ) {}

  async listar(filtro: ListarProdutosDto): Promise<Paginado<ProdutoResposta>> {
    const condicoes: string[] = [];
    const parametros: unknown[] = [];

    if (!filtro.incluirServicos) {
      condicoes.push('(p.modo_estoque IS NULL OR p.modo_estoque <> ?)');
      parametros.push(MODO_ESTOQUE.SERVICO);
    }
    if (filtro.busca) {
      const alternativas = ['p.nome_produto LIKE ?', 'p.cod_barra = ?'];
      parametros.push(`%${filtro.busca}%`, filtro.busca);
      if (/^\d{1,8}$/.test(filtro.busca)) {
        alternativas.push('p.id = ?');
        parametros.push(Number(filtro.busca));
      }
      condicoes.push(`(${alternativas.join(' OR ')})`);
    }
    if (filtro.idFornecedor) {
      condicoes.push('p.id_fornecedor = ?');
      parametros.push(filtro.idFornecedor);
    }
    if (filtro.somenteDisponiveis) condicoes.push('e.quantidade > 0');

    const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';
    const [linhas, [{ total }]] = await Promise.all([
      this.fonte.query(`${SELECT_PRODUTO} ${where} ORDER BY p.nome_produto ASC LIMIT ? OFFSET ?`, [
        ...parametros,
        filtro.limit,
        offset(filtro),
      ]) as Promise<LinhaProduto[]>,
      this.fonte.query(
        `SELECT COUNT(*) AS total FROM cad_produtos p LEFT JOIN mv_estoque e ON e.id_produto = p.id ${where}`,
        parametros,
      ) as Promise<Array<{ total: number | string }>>,
    ]);
    return paginado(linhas.map(paraResposta), Number(total), filtro.page, filtro.limit);
  }

  async obter(id: number): Promise<ProdutoResposta> {
    const [linha] = (await this.fonte.query(`${SELECT_PRODUTO} WHERE p.id = ?`, [id])) as LinhaProduto[];
    if (!linha) throw new NotFoundException(`Produto #${id} não encontrado`);
    return paraResposta(linha);
  }

  async obterPorCodigo(codigoBarras: string): Promise<ProdutoResposta> {
    const [linha] = (await this.fonte.query(`${SELECT_PRODUTO} WHERE p.cod_barra = ? LIMIT 1`, [
      codigoBarras.trim(),
    ])) as LinhaProduto[];
    if (!linha) throw new NotFoundException(`Nenhum produto com o código ${codigoBarras}`);
    return paraResposta(linha);
  }

  async estoqueBaixo(filtro: EstoqueBaixoDto): Promise<Paginado<ProdutoResposta>> {
    const limite = filtro.limite ?? this.config.valores.estoqueBaixoLimitePadrao;
    const where = `WHERE p.modo_estoque = ? AND e.quantidade IS NOT NULL
      AND e.quantidade <= CASE WHEN p.min_estoque > 0 THEN p.min_estoque ELSE ? END`;
    const parametros = [MODO_ESTOQUE.CONTROLA, limite];
    const [linhas, [{ total }]] = await Promise.all([
      this.fonte.query(
        `${SELECT_PRODUTO} ${where} ORDER BY e.quantidade ASC, p.nome_produto ASC LIMIT ? OFFSET ?`,
        [...parametros, filtro.limit, offset(filtro)],
      ) as Promise<LinhaProduto[]>,
      this.fonte.query(
        `SELECT COUNT(*) AS total FROM cad_produtos p JOIN mv_estoque e ON e.id_produto = p.id ${where}`,
        parametros,
      ) as Promise<Array<{ total: number | string }>>,
    ]);
    return paginado(linhas.map(paraResposta), Number(total), filtro.page, filtro.limit);
  }

  async listarTipos(): Promise<ProdutoTipo[]> {
    return this.tipos.find({ order: { nome: 'ASC' } });
  }

  async criar(dto: CriarProdutoDto): Promise<ProdutoResposta> {
    await this.garantirNomeUnico(dto.nome);
    if (dto.codigoBarras) await this.garantirCodigoUnico(dto.codigoBarras);
    if (dto.idFornecedor) await this.garantirFornecedor(dto.idFornecedor);
    const idTipo = await this.resolverTipo(dto.idTipo);

    const id = await this.fonte.transaction(async (manager) => {
      const resultado = await manager.insert(Produto, {
        nome: dto.nome,
        codigoBarras: dto.codigoBarras ?? null,
        valorCompra: dto.valorCompra ?? null,
        precoVista: dto.precoVista,
        precoPrazo: dto.precoPrazo ?? dto.precoVista,
        estoqueMinimo: dto.estoqueMinimo ?? null,
        idFornecedor: dto.idFornecedor ?? null,
        idTipo,
        unidade: dto.unidade ?? null,
        informacoesAdicionais: dto.informacoesAdicionais ?? null,
        modoEstoque: MODO_ESTOQUE.CONTROLA,
        impostos: 0,
        grade: 0,
      });
      const novoId = Number(resultado.identifiers[0].id);

      if (!dto.codigoBarras) {
        await manager.update(Produto, { id: novoId }, { codigoBarras: await this.gerarCodigo(manager, novoId) });
      }
      await manager.insert(Estoque, { idProduto: novoId, quantidade: 0, modoEstoque: MODO_ESTOQUE.CONTROLA });
      return novoId;
    });
    return this.obter(id);
  }

  async atualizar(id: number, dto: AtualizarProdutoDto): Promise<ProdutoResposta> {
    await this.obter(id);
    if (dto.nome) await this.garantirNomeUnico(dto.nome, id);
    if (dto.codigoBarras) await this.garantirCodigoUnico(dto.codigoBarras, id);
    if (dto.idFornecedor) await this.garantirFornecedor(dto.idFornecedor);
    if (dto.idTipo) await this.resolverTipo(dto.idTipo);
    if (Object.keys(dto).length > 0) await this.produtos.update({ id }, dto);
    return this.obter(id);
  }

  async remover(id: number): Promise<void> {
    const produto = await this.obter(id);
    const [vinculos] = (await this.fonte.query(
      `SELECT
         EXISTS(SELECT 1 FROM mv_vendas_movimento WHERE id_produto = ?) AS vendas,
         EXISTS(SELECT 1 FROM mv_estoque_historico WHERE id_produto = ?) AS estoque`,
      [id, id],
    )) as Array<{ vendas: number | string; estoque: number | string }>;
    if (Number(vinculos.vendas) || Number(vinculos.estoque)) {
      throw new ConflictException('Produto possui vendas ou movimentação de estoque e não pode ser excluído');
    }
    if ((produto.quantidadeEstoque ?? 0) !== 0) {
      throw new ConflictException('Produto possui saldo em estoque e não pode ser excluído');
    }
    await this.fonte.transaction(async (manager) => {
      await manager.query('DELETE FROM cad_produtos_obs WHERE id_produto = ?', [id]);
      await manager.delete(Estoque, { idProduto: id });
      await manager.delete(Produto, { id });
    });
  }

  private async gerarCodigo(manager: EntityManager, id: number): Promise<string> {
    const candidatos = [codigoBarrasProduto(id)];
    for (let i = 0; i < 5; i += 1) {
      candidatos.push(codigoBarrasProduto(Math.floor(Math.random() * 99_999_999_999)));
    }
    for (const codigo of candidatos) {
      const existe = await manager.findOne(Produto, { where: { codigoBarras: codigo }, select: { id: true } });
      if (!existe) return codigo;
    }
    throw new ConflictException('Não foi possível gerar um código de barras único; informe codigoBarras');
  }

  private async garantirNomeUnico(nome: string, ignorarId?: number): Promise<void> {
    const existente = await this.produtos.findOne({
      where: ignorarId ? { nome, id: Not(ignorarId) } : { nome },
      select: { id: true },
    });
    if (existente) throw new ConflictException(`Já existe um produto com o nome "${nome}" (#${existente.id})`);
  }

  private async garantirCodigoUnico(codigoBarras: string, ignorarId?: number): Promise<void> {
    const existente = await this.produtos.findOne({
      where: ignorarId ? { codigoBarras, id: Not(ignorarId) } : { codigoBarras },
      select: { id: true },
    });
    if (existente) {
      throw new ConflictException(`O código ${codigoBarras} já pertence ao produto #${existente.id}`);
    }
  }

  private async garantirFornecedor(idFornecedor: number): Promise<void> {
    const existe = await this.fonte.getRepository(Fornecedor).exists({ where: { id: idFornecedor } });
    if (!existe) throw new BadRequestException(`Fornecedor #${idFornecedor} não existe`);
  }

  private async resolverTipo(idTipo?: number): Promise<number> {
    if (idTipo) {
      if (!(await this.tipos.exists({ where: { id: idTipo } }))) {
        throw new BadRequestException(`Tipo de produto #${idTipo} não existe`);
      }
      return idTipo;
    }
    const [primeiro] = await this.tipos.find({ order: { id: 'ASC' }, take: 1 });
    if (!primeiro) throw new BadRequestException('Nenhum tipo de produto cadastrado (cad_produtos_tipo)');
    return primeiro.id;
  }
}

