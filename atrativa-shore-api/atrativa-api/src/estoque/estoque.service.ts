import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, type EntityManager, In } from 'typeorm';
import type { UsuarioAutenticado } from '../auth/usuario-autenticado.js';
import { ConfiguracaoService } from '../config/configuracao.service.js';
import {
  MODO_ESTOQUE,
  MODO_VENDA,
  NAO,
  ORIGEM_FINANCEIRO,
  PLANO_CONTAS,
  TIPO_FINANCEIRO,
} from '../common/constantes/legado.js';
import { offset, paginado, type Paginado } from '../common/dto/paginacao.dto.js';
import { PREFIXO_NOTA_AJUSTE } from '../common/utils/codigos.js';
import { controleDisponivel } from '../common/utils/controle.js';
import { dataIsoValida, dataNoFuso } from '../common/utils/datas.js';
import { multiplicar, paraCentavos, paraReais, somar } from '../common/utils/dinheiro.js';
import { numero, numeroOuNulo } from '../common/utils/transformadores.js';
import { VerificacaoBancoService } from '../database/verificacao-banco.service.js';
import { Financeiro } from '../financeiro/entities/financeiro.entity.js';
import { Produto } from '../produtos/entities/produto.entity.js';
import type { ListarProdutosDto } from '../produtos/dto/produto.dto.js';
import { ProdutosService, type ProdutoResposta } from '../produtos/produtos.service.js';
import type {
  ListarMovimentacoesDto,
  RegistrarAjusteDto,
  RegistrarEntradaDto,
  TipoMovimentacao,
} from './dto/estoque.dto.js';
import { EstoqueHistorico } from './entities/estoque-historico.entity.js';
import { baixarSaldo, bloquearSaldos, creditarSaldo } from './operacoes-saldo.js';

export interface Movimentacao {
  origem: 'HISTORICO' | 'VENDA';
  id: number;
  data: string | null;
  controle: string | null;
  tipo: TipoMovimentacao;
  idProduto: number | null;
  produto: string;
  quantidade: number;
  valorUnitario: number | null;
  documento: string | null;
}

export interface ResultadoEntrada {
  controle: string;
  numeroNota: string;
  dataLancamento: string;
  valorTotal: number;
  itens: Array<{ idProduto: number; produto: string | null; quantidade: number; valorCompra: number; saldoAtual: number }>;
}

interface ProdutoBasico {
  id: number;
  nome: string | null;
  valorCompra: number | null;
  modoEstoque: number | null;
  idFornecedor: number | null;
}

const TIPO_HISTORICO = `CASE
    WHEN h.numerodanota LIKE '${PREFIXO_NOTA_AJUSTE}%' THEN IF(h.quantidade < 0, 'AJUSTE_SAIDA', 'AJUSTE_ENTRADA')
    WHEN h.numerodanota LIKE 'V%' THEN 'TROCA'
    ELSE 'ENTRADA' END`;

@Injectable()
export class EstoqueService {
  constructor(
    private readonly fonte: DataSource,
    private readonly config: ConfiguracaoService,
    private readonly produtos: ProdutosService,
    private readonly banco: VerificacaoBancoService,
  ) {}

  listar(filtro: ListarProdutosDto): Promise<Paginado<ProdutoResposta>> {
    return this.produtos.listar(filtro);
  }

  async saldo(idProduto: number): Promise<ProdutoResposta & { ultimasMovimentacoes: Movimentacao[] }> {
    const produto = await this.produtos.obter(idProduto);
    const movimentos = await this.movimentacoes({ idProduto, page: 1, limit: 10 });
    return { ...produto, ultimasMovimentacoes: movimentos.data };
  }

  async registrarEntrada(dto: RegistrarEntradaDto, usuario: UsuarioAutenticado): Promise<ResultadoEntrada> {
    await this.banco.garantirTransacoes();
    const fuso = this.config.fusoHorario;
    const hoje = dataNoFuso(new Date(), fuso);
    const dataLancamento = dto.dataLancamento ?? hoje;
    this.validarData(dataLancamento, 'dataLancamento', hoje);
    if (dto.vencimento && !dataIsoValida(dto.vencimento)) {
      throw new BadRequestException('vencimento não é uma data válida');
    }

    const { terminal, turno } = this.config.pdv;

    return this.fonte.transaction('READ COMMITTED', async (manager) => {
      const nomeFornecedor = dto.idFornecedor ? await this.nomeFornecedor(manager, dto.idFornecedor) : null;
      const produtos = await this.carregarProdutos(manager, dto.itens.map((item) => item.idProduto));
      await bloquearSaldos(manager, [...produtos.keys()]);

      const controle = await controleDisponivel(manager, fuso, ['mv_estoque_historico', 'mv_financeiro']);
      const numeroNota = dto.numeroNota ?? (await this.proximoNumeroNota(manager));

      const itens: ResultadoEntrada['itens'] = [];
      for (const item of dto.itens) {
        const produto = produtos.get(item.idProduto)!;
        const valorCompra = item.valorCompra ?? produto.valorCompra ?? 0;
        await manager.insert(EstoqueHistorico, {
          controle,
          dataLancamento,
          idProduto: produto.id,
          quantidade: item.quantidade,
          numeroNota,
          terminal,
          valorCompra,
          controleVenda: '',
          estornado: 0,
          idFornecedor: dto.idFornecedor ?? produto.idFornecedor ?? 0,
          turno,
        });
        await creditarSaldo(manager, produto.id, item.quantidade);
        if (item.valorCompra !== undefined && dto.atualizarValorCompra !== false) {
          await manager.update(Produto, { id: produto.id }, { valorCompra: item.valorCompra });
        }
        itens.push({ idProduto: produto.id, produto: produto.nome, quantidade: item.quantidade, valorCompra, saldoAtual: 0 });
      }

      const totalCentavos = somar(itens.map((item) => multiplicar(paraCentavos(item.valorCompra), item.quantidade)));
      if (totalCentavos > 0) {
        const valor = paraReais(totalCentavos);
        await manager.insert(Financeiro, {
          controle,
          dataLancamento,
          dataVencimento: dto.vencimento ?? dataLancamento,
          origem: ORIGEM_FINANCEIRO.ENTRADA_MERCADORIA,
          tipo: TIPO_FINANCEIRO.SAIDA,
          parcela: 1,
          valorPago: valor,
          idCliente: usuario.id,
          historico: `Compra de mercadoria, nota: ${numeroNota} Fornecedor: ${nomeFornecedor ?? ''} Total de parcelas: 1`.slice(0, 200),
          idPlano: PLANO_CONTAS.COMPRA_MERCADORIA,
          valorParcela: valor,
          efetuado: NAO,
          documento: `NOTA:${numeroNota}`.slice(0, 15),
          estornado: 0,
          terminal,
          turno,
        });
      }

      const saldos = await bloquearSaldos(manager, itens.map((item) => item.idProduto));
      for (const item of itens) item.saldoAtual = saldos.get(item.idProduto) ?? 0;

      return { controle, numeroNota, dataLancamento, valorTotal: paraReais(totalCentavos), itens };
    });
  }

  async registrarAjuste(dto: RegistrarAjusteDto): Promise<ProdutoResposta> {
    await this.banco.garantirTransacoes();
    const fuso = this.config.fusoHorario;
    const { terminal, turno } = this.config.pdv;

    await this.fonte.transaction('READ COMMITTED', async (manager) => {
      const produto = (await this.carregarProdutos(manager, [dto.idProduto])).get(dto.idProduto)!;
      await bloquearSaldos(manager, [produto.id]);
      if (dto.quantidade < 0) {
        await baixarSaldo(manager, produto.id, -dto.quantidade, produto.nome ?? `#${produto.id}`);
      } else {
        await creditarSaldo(manager, produto.id, dto.quantidade);
      }
      const controle = await controleDisponivel(manager, fuso, ['mv_estoque_historico']);
      await manager.insert(EstoqueHistorico, {
        controle,
        dataLancamento: dataNoFuso(new Date(), fuso),
        idProduto: produto.id,
        quantidade: dto.quantidade,
        numeroNota: `${PREFIXO_NOTA_AJUSTE}${dto.motivo}`,
        terminal,
        valorCompra: produto.valorCompra ?? 0,
        controleVenda: '',
        estornado: 0,
        idFornecedor: 0,
        turno,
      });
    });
    return this.produtos.obter(dto.idProduto);
  }

  async movimentacoes(filtro: ListarMovimentacoesDto): Promise<Paginado<Movimentacao>> {
    const filtrosHistorico: string[] = ['h.estornado = 0'];
    const filtrosVenda: string[] = ['m.estornado = 0', `m.modo_venda = ${MODO_VENDA.PRODUTO}`];
    const parametrosHistorico: unknown[] = [];
    const parametrosVenda: unknown[] = [];

    if (filtro.idProduto) {
      filtrosHistorico.push('h.id_produto = ?');
      parametrosHistorico.push(filtro.idProduto);
      filtrosVenda.push('m.id_produto = ?');
      parametrosVenda.push(filtro.idProduto);
    }
    if (filtro.inicio) {
      filtrosHistorico.push('h.data_lanca >= ?');
      parametrosHistorico.push(filtro.inicio);
      filtrosVenda.push('m.data_venda >= ?');
      parametrosVenda.push(filtro.inicio);
    }
    if (filtro.fim) {
      filtrosHistorico.push('h.data_lanca <= ?');
      parametrosHistorico.push(filtro.fim);
      filtrosVenda.push('m.data_venda <= ?');
      parametrosVenda.push(filtro.fim);
    }

    const partes: string[] = [];
    const parametros: unknown[] = [];
    if (filtro.tipo !== 'VENDA') {
      partes.push(`SELECT 'HISTORICO' AS origem, h.id, h.data_lanca AS data, h.controle, ${TIPO_HISTORICO} AS tipo,
                          h.id_produto, h.quantidade, h.vr_compra AS valor_unitario, h.numerodanota AS documento
                     FROM mv_estoque_historico h WHERE ${filtrosHistorico.join(' AND ')}`);
      parametros.push(...parametrosHistorico);
    }
    if (!filtro.tipo || filtro.tipo === 'VENDA') {
      partes.push(`SELECT 'VENDA' AS origem, m.id, m.data_venda AS data, m.controle, 'VENDA' AS tipo,
                          m.id_produto, -m.quant AS quantidade, m.valor AS valor_unitario, m.controle AS documento
                     FROM mv_vendas_movimento m WHERE ${filtrosVenda.join(' AND ')}`);
      parametros.push(...parametrosVenda);
    }

    const filtroTipo = filtro.tipo && filtro.tipo !== 'VENDA' ? 'WHERE mov.tipo = ?' : '';
    const parametrosTipo = filtroTipo ? [filtro.tipo] : [];
    const uniao = partes.join(' UNION ALL ');

    const [linhas, [{ total }]] = await Promise.all([
      this.fonte.query(
        `SELECT mov.*, p.nome_produto FROM (${uniao}) mov
           LEFT JOIN cad_produtos p ON p.id = mov.id_produto
           ${filtroTipo}
          ORDER BY mov.data DESC, mov.controle DESC, mov.id DESC
          LIMIT ? OFFSET ?`,
        [...parametros, ...parametrosTipo, filtro.limit, offset(filtro)],
      ) as Promise<Array<Record<string, unknown>>>,
      this.fonte.query(`SELECT COUNT(*) AS total FROM (${uniao}) mov ${filtroTipo}`, [
        ...parametros,
        ...parametrosTipo,
      ]) as Promise<Array<{ total: number | string }>>,
    ]);

    return paginado(
      linhas.map((linha) => ({
        origem: linha.origem as Movimentacao['origem'],
        id: Number(linha.id),
        data: (linha.data as string | null) ?? null,
        controle: (linha.controle as string | null) ?? null,
        tipo: linha.tipo as TipoMovimentacao,
        idProduto: linha.id_produto === null ? null : Number(linha.id_produto),
        produto: (linha.nome_produto as string | null) ?? `Produto removido (#${String(linha.id_produto)})`,
        quantidade: numero(linha.quantidade, 3),
        valorUnitario: numeroOuNulo(linha.valor_unitario),
        documento: (linha.documento as string | null) ?? null,
      })),
      Number(total),
      filtro.page,
      filtro.limit,
    );
  }

  private validarData(data: string, campo: string, hoje: string): void {
    if (!dataIsoValida(data)) throw new BadRequestException(`${campo} não é uma data válida`);
    if (data > hoje) throw new BadRequestException(`${campo} não pode ser futura`);
  }

  private async carregarProdutos(manager: EntityManager, ids: number[]): Promise<Map<number, ProdutoBasico>> {
    const unicos = [...new Set(ids)];
    const encontrados = await manager.find(Produto, {
      where: { id: In(unicos) },
      select: { id: true, nome: true, valorCompra: true, modoEstoque: true, idFornecedor: true },
    });
    const mapa = new Map(encontrados.map((produto) => [produto.id, produto]));
    const faltando = unicos.filter((id) => !mapa.has(id));
    if (faltando.length) throw new NotFoundException(`Produto(s) não encontrado(s): ${faltando.join(', ')}`);
    const semEstoque = encontrados.filter((produto) => produto.modoEstoque !== MODO_ESTOQUE.CONTROLA);
    if (semEstoque.length) {
      throw new BadRequestException(
        `Produto(s) que não controlam estoque: ${semEstoque.map((p) => p.nome ?? p.id).join(', ')}`,
      );
    }
    return mapa;
  }

  private async nomeFornecedor(manager: EntityManager, id: number): Promise<string> {
    const [linha] = (await manager.query('SELECT nome_fornecedor FROM cad_fornecedores WHERE id = ?', [id])) as Array<{
      nome_fornecedor: string | null;
    }>;
    if (!linha) throw new BadRequestException(`Fornecedor #${id} não existe`);
    return linha.nome_fornecedor ?? '';
  }

  private async proximoNumeroNota(manager: EntityManager): Promise<string> {
    const [{ ultimo }] = (await manager.query(
      "SELECT MAX(CAST(numerodanota AS UNSIGNED)) AS ultimo FROM mv_estoque_historico WHERE numerodanota REGEXP '^[0-9]+$'",
    )) as Array<{ ultimo: number | string | null }>;
    return String(Number(ultimo ?? 0) + 1).padStart(8, '0');
  }
}
