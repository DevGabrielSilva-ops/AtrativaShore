import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, type EntityManager, In, QueryFailedError } from 'typeorm';
import type { UsuarioAutenticado } from '../auth/usuario-autenticado.js';
import { buscarCaixaAberto } from '../caixa/consultas-caixa.js';
import { consultarCreditoCarne, garantirLimiteCarne } from '../carnes/limite-carne.js';
import { ConfiguracaoService } from '../config/configuracao.service.js';
import {
  FormaPagamento,
  ID_CONSUMIDOR_NAO_IDENTIFICADO,
  MODO_ESTOQUE,
  MODO_LANCAMENTO,
  MODO_VENDA,
  NAO,
  ORIGEM_FINANCEIRO,
  PLANO_CONTAS,
  SIM,
  TIPO_FINANCEIRO,
} from '../common/constantes/legado.js';
import { offset, paginado, type Paginado } from '../common/dto/paginacao.dto.js';
import { codigoCarne, documentoVenda, notaTroca } from '../common/utils/codigos.js';
import { controleDisponivel } from '../common/utils/controle.js';
import { dataIsoValida, dataNoFuso, vencimentosCarne } from '../common/utils/datas.js';
import {
  type Centavos,
  dividirParcelas,
  formatarReais,
  paraCentavos,
  paraReais,
} from '../common/utils/dinheiro.js';
import { numero } from '../common/utils/transformadores.js';
import { VerificacaoBancoService } from '../database/verificacao-banco.service.js';
import { EmpresaService } from '../empresa/empresa.service.js';
import { EstoqueHistorico } from '../estoque/entities/estoque-historico.entity.js';
import { agruparQuantidades, baixarSaldo, bloquearSaldos, creditarSaldo } from '../estoque/operacoes-saldo.js';
import { Financeiro } from '../financeiro/entities/financeiro.entity.js';
import { Produto } from '../produtos/entities/produto.entity.js';
import { calcularVenda, ErroCalculoVenda, type ResultadoCalculo } from './calculo/calculo-venda.js';
import type { ItemVendaDto, ListarVendasDto, RegistrarVendaDto } from './dto/venda.dto.js';
import { VendaItem } from './entities/venda-item.entity.js';
import { Venda } from './entities/venda.entity.js';
import {
  COLUNA_FORMA,
  type LinhaVenda,
  mapearVenda,
  SELECT_VENDA,
  type VendaResumo,
} from './vendas.consultas.js';

export interface ItemVendido {
  id: number;
  idProduto: number | null;
  produto: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
}

export interface ParcelaCarneResumo {
  codigo: string | null;
  parcela: number;
  vencimento: string | null;
  valor: number;
  situacao: 'ABERTA' | 'PAGA' | 'ESTORNADA';
  dataPagamento: string | null;
  valorPago: number | null;
}

export interface VendaDetalhe extends VendaResumo {
  subtotalItens: number;
  creditoTroca: number;
  itens: ItemVendido[];
  itensTroca: ItemVendido[];
  parcelasCarne: ParcelaCarneResumo[];
}

interface ProdutoVenda {
  id: number;
  nome: string | null;
  precoVista: number | null;
  precoPrazo: number | null;
  valorCompra: number | null;
  modoEstoque: number | null;
}

const TENTATIVAS_CONTROLE = 3;

@Injectable()
export class VendasService {
  private readonly logger = new Logger('Vendas');

  constructor(
    private readonly fonte: DataSource,
    private readonly config: ConfiguracaoService,
    private readonly empresa: EmpresaService,
    private readonly banco: VerificacaoBancoService,
  ) {}

  async registrar(dto: RegistrarVendaDto, usuario: UsuarioAutenticado): Promise<VendaDetalhe> {
    await this.banco.garantirTransacoes();
    const { terminal, exigirCaixaAberto } = this.config.pdv;
    if (exigirCaixaAberto && !(await buscarCaixaAberto(this.fonte, terminal))) {
      throw new ConflictException(`Abra o caixa do terminal ${terminal} antes de registrar vendas`);
    }

    const idCliente = dto.idCliente ?? ID_CONSUMIDOR_NAO_IDENTIFICADO;
    const temCarne = dto.pagamentos.some((pagamento) => pagamento.forma === FormaPagamento.CARNE);
    this.validarCarne(dto, idCliente, temCarne);
    const empresa = await this.empresa.obter();

    for (let tentativa = 1; ; tentativa += 1) {
      try {
        const controle = await this.fonte.transaction('READ COMMITTED', (manager) =>
          this.registrarNaTransacao(manager, dto, usuario, idCliente, empresa.maxDesconto),
        );
        return this.obterPorControle(controle);
      } catch (erro) {
        const colisao =
          erro instanceof QueryFailedError &&
          (erro.driverError as { code?: string }).code === 'ER_DUP_ENTRY' &&
          String((erro.driverError as { sqlMessage?: string }).sqlMessage).includes('controle');
        if (colisao && tentativa < TENTATIVAS_CONTROLE) {
          this.logger.warn('Controle de venda já usado por outro terminal; gerando outro');
          continue;
        }
        if (erro instanceof ErroCalculoVenda) throw new BadRequestException(erro.message);
        throw erro;
      }
    }
  }

  private async registrarNaTransacao(
    manager: EntityManager,
    dto: RegistrarVendaDto,
    usuario: UsuarioAutenticado,
    idCliente: number,
    descontoMaximo: number | null,
  ): Promise<string> {
    const { terminal, turno } = this.config.pdv;
    const fuso = this.config.fusoHorario;
    const hoje = dataNoFuso(new Date(), fuso);
    const itensTroca = dto.itensTroca ?? [];

    const nomeCliente = idCliente > 0 ? await this.nomeCliente(manager, idCliente) : null;
    const produtos = await this.carregarProdutos(manager, [...dto.itens, ...itensTroca]);

    const calculo = calcularVenda({
      itens: dto.itens.map((item) => this.itemCalculo(item, produtos)),
      trocas: itensTroca.map((item) => this.itemCalculo(item, produtos)),
      desconto: paraCentavos(dto.desconto ?? 0),
      acrescimo: paraCentavos(dto.acrescimo ?? 0),
      pagamentos: dto.pagamentos.map((pagamento) => ({
        forma: pagamento.forma,
        valor: paraCentavos(pagamento.valor),
      })),
      descontoMaximoPercentual: descontoMaximo,
    });

    const valorCarne = calculo.porForma[FormaPagamento.CARNE];
    if (valorCarne > 0) {
      const credito = await consultarCreditoCarne(manager, idCliente, this.config.valores.carneLimite, true);
      if (!credito) throw new NotFoundException(`Cliente #${idCliente} não encontrado`);
      garantirLimiteCarne(credito, valorCarne, nomeCliente);
    }

    const saidas = agruparQuantidades(
      calculo.itens.filter((item) => produtos.get(item.idProduto)!.modoEstoque === MODO_ESTOQUE.CONTROLA),
    );
    const saldos = await bloquearSaldos(manager, [...saidas.keys(), ...itensTroca.map((item) => item.idProduto)]);
    const insuficientes = [...saidas]
      .filter(([idProduto, quantidade]) => (saldos.get(idProduto) ?? 0) + 0.0005 < quantidade)
      .map(([idProduto, quantidade]) => {
        const nome = produtos.get(idProduto)!.nome ?? `#${idProduto}`;
        return `${nome} (pedido: ${quantidade}, disponível: ${saldos.get(idProduto) ?? 0})`;
      });
    if (insuficientes.length) {
      throw new ConflictException(`Estoque insuficiente: ${insuficientes.join('; ')}`);
    }

    const controle = await controleDisponivel(manager, fuso, ['mv_vendas', 'mv_vendas_movimento']);
    const parcelasCarne = this.montarParcelas(calculo, dto, controle, hoje);
    const aVistaCaixa = calculo.porForma[FormaPagamento.DINHEIRO] + calculo.porForma[FormaPagamento.PIX];

    await manager.insert(Venda, {
      controle,
      dataVenda: hoje,
      idCliente,
      idLogin: usuario.id,
      valorTotal: paraReais(calculo.liquido),
      valorDesconto: paraReais(calculo.desconto),
      parcelas: parcelasCarne.length + (aVistaCaixa > 0 ? 1 : 0),
      estornado: 0,
      dataEstorno: null,
      valorDinheiro: paraReais(calculo.porForma[FormaPagamento.DINHEIRO]),
      valorCheque: 0,
      valorCartao: paraReais(calculo.porForma[FormaPagamento.CARTAO]),
      valorCarne: paraReais(calculo.porForma[FormaPagamento.CARNE]),
      valorTicket: 0,
      valorPix: paraReais(calculo.porForma[FormaPagamento.PIX]),
      terminal,
      turno,
      idCartao: 0,
    });

    const base = { controle, dataVenda: hoje, idLogin: usuario.id, idCliente, estornado: 0, terminal, turno, idGrade: 0 };
    await manager.insert(VendaItem, [
      ...calculo.itens.map((item) => ({
        ...base,
        idProduto: item.idProduto,
        valorUnitario: paraReais(item.valorUnitario),
        quantidade: item.quantidade,
        valorTotal: paraReais(item.total),
        modoVenda: MODO_VENDA.PRODUTO,
        modoLancamento: MODO_LANCAMENTO.PADRAO,
      })),
      ...calculo.trocas.map((item) => ({
        ...base,
        idProduto: item.idProduto,
        valorUnitario: paraReais(item.valorUnitario),
        quantidade: item.quantidade,
        valorTotal: paraReais(item.total),
        modoVenda: MODO_VENDA.TROCA,
        modoLancamento: MODO_LANCAMENTO.TROCA,
      })),
    ]);

    for (const [idProduto, quantidade] of saidas) {
      await baixarSaldo(manager, idProduto, quantidade, produtos.get(idProduto)!.nome ?? `#${idProduto}`);
    }

    for (const troca of calculo.trocas) {
      const produto = produtos.get(troca.idProduto)!;
      if (produto.modoEstoque !== MODO_ESTOQUE.CONTROLA) continue;
      await manager.insert(EstoqueHistorico, {
        controle,
        dataLancamento: hoje,
        idProduto: produto.id,
        quantidade: troca.quantidade,
        numeroNota: notaTroca(controle),
        terminal,
        valorCompra: paraReais(troca.valorUnitario),
        controleVenda: controle,
        estornado: 0,
        idFornecedor: 0,
        turno,
      });
      await creditarSaldo(manager, produto.id, troca.quantidade);
    }

    const historicoVenda = `CONTROLE: ${controle} VENDEDOR: ${usuario.login} TERMINAL: ${terminal} TURNO: ${turno}`;
    const lancamentos: Array<Partial<Financeiro>> = [];
    if (aVistaCaixa > 0) {
      lancamentos.push({
        controle,
        dataLancamento: hoje,
        dataVencimento: hoje,
        dataPagamento: hoje,
        origem: ORIGEM_FINANCEIRO.VENDA,
        tipo: TIPO_FINANCEIRO.ENTRADA,
        parcela: 1,
        valorPago: paraReais(aVistaCaixa),
        idCliente,
        valorDesconto: paraReais(calculo.desconto),
        historico: historicoVenda.slice(0, 200),
        idPlano: PLANO_CONTAS.VENDA_A_VISTA,
        valorParcela: paraReais(aVistaCaixa),
        efetuado: SIM,
        documento: documentoVenda(controle),
        estornado: 0,
        terminal,
        turno,
      });
    }
    for (const parcela of parcelasCarne) {
      lancamentos.push({
        controle,
        dataLancamento: hoje,
        dataVencimento: parcela.vencimento,
        dataPagamento: null,
        origem: ORIGEM_FINANCEIRO.CARNE,
        tipo: TIPO_FINANCEIRO.ENTRADA,
        parcela: parcela.numero,
        valorPago: paraReais(parcela.valor),
        idCliente,
        historico: (
          `Cód. Carnê: ${parcela.codigo} Total de parcelas: ${parcela.numero} de ${parcelasCarne.length}  ` +
          `Cliente: ${nomeCliente ?? ''}  Valor parcelado: ${formatarReais(calculo.porForma[FormaPagamento.CARNE])}`
        ).slice(0, 200),
        idPlano: PLANO_CONTAS.VENDA_CARNE,
        valorParcela: paraReais(parcela.valor),
        efetuado: NAO,
        documento: documentoVenda(controle),
        codigoCarne: parcela.codigo,
        estornado: 0,
        terminal,
        turno,
      });
    }
    if (lancamentos.length) await manager.insert(Financeiro, lancamentos);

    return controle;
  }

  private validarCarne(dto: RegistrarVendaDto, idCliente: number, temCarne: boolean): void {
    if (!temCarne) {
      if (dto.parcelasCarne || dto.primeiroVencimento) {
        throw new BadRequestException('parcelasCarne e primeiroVencimento só se aplicam a pagamento em CARNE');
      }
      return;
    }
    if (idCliente <= 0) throw new BadRequestException('Venda no carnê exige um cliente identificado');
    if (!dto.parcelasCarne) throw new BadRequestException('Informe parcelasCarne para pagamento em CARNE');
    if (dto.parcelasCarne > this.config.valores.carneMaxParcelas) {
      throw new BadRequestException(`O carnê permite no máximo ${this.config.valores.carneMaxParcelas} parcelas`);
    }
    if (dto.primeiroVencimento) {
      const hoje = dataNoFuso(new Date(), this.config.fusoHorario);
      if (!dataIsoValida(dto.primeiroVencimento) || dto.primeiroVencimento <= hoje) {
        throw new BadRequestException('primeiroVencimento deve ser uma data válida posterior a hoje');
      }
    }
  }

  private montarParcelas(
    calculo: ResultadoCalculo,
    dto: RegistrarVendaDto,
    controle: string,
    hoje: string,
  ): Array<{ numero: number; valor: Centavos; vencimento: string; codigo: string }> {
    const totalCarne = calculo.porForma[FormaPagamento.CARNE];
    if (totalCarne === 0) return [];
    const quantidade = dto.parcelasCarne!;
    const valores = dividirParcelas(totalCarne, quantidade);
    if (valores.some((valor) => valor < 1)) {
      throw new BadRequestException('Valor por parcela menor que R$ 0,01; reduza o número de parcelas');
    }
    const vencimentos = vencimentosCarne(hoje, quantidade, dto.primeiroVencimento);
    return valores.map((valor, indice) => ({
      numero: indice + 1,
      valor,
      vencimento: vencimentos[indice],
      codigo: codigoCarne(controle, indice + 1),
    }));
  }

  private itemCalculo(item: ItemVendaDto, produtos: Map<number, ProdutoVenda>) {
    const produto = produtos.get(item.idProduto)!;
    const sugerido = (produto.precoPrazo ?? 0) > 0 ? produto.precoPrazo! : (produto.precoVista ?? 0);
    const preco = item.precoUnitario ?? sugerido;
    if (preco <= 0) {
      throw new BadRequestException(
        `${produto.nome ?? `Produto #${produto.id}`} não tem preço cadastrado; informe precoUnitario`,
      );
    }
    return { idProduto: produto.id, quantidade: item.quantidade, precoUnitario: paraCentavos(preco) };
  }

  private async carregarProdutos(manager: EntityManager, itens: ItemVendaDto[]): Promise<Map<number, ProdutoVenda>> {
    const ids = [...new Set(itens.map((item) => item.idProduto))];
    const encontrados = await manager.find(Produto, {
      where: { id: In(ids) },
      select: { id: true, nome: true, precoVista: true, precoPrazo: true, valorCompra: true, modoEstoque: true },
    });
    const mapa = new Map(encontrados.map((produto) => [produto.id, produto]));
    const faltando = ids.filter((id) => !mapa.has(id));
    if (faltando.length) throw new NotFoundException(`Produto(s) não encontrado(s): ${faltando.join(', ')}`);
    const servicos = encontrados.filter((produto) => produto.modoEstoque === MODO_ESTOQUE.SERVICO);
    if (servicos.length) {
      throw new BadRequestException(
        `Item(ns) de serviço não podem ser vendidos aqui: ${servicos.map((p) => p.nome).join(', ')}. ` +
          'Recebimento de carnê é feito em /carnes/baixa.',
      );
    }
    return mapa;
  }

  private async nomeCliente(manager: EntityManager, idCliente: number): Promise<string | null> {
    const [linha] = (await manager.query('SELECT nome_cliente FROM cad_clientes WHERE id = ?', [idCliente])) as Array<{
      nome_cliente: string | null;
    }>;
    if (!linha) throw new NotFoundException(`Cliente #${idCliente} não encontrado`);
    return linha.nome_cliente;
  }

  async estornar(id: number): Promise<VendaDetalhe> {
    await this.banco.garantirTransacoes();
    const hoje = dataNoFuso(new Date(), this.config.fusoHorario);

    const controle = await this.fonte.transaction('READ COMMITTED', async (manager) => {
      const [venda] = (await manager.query(
        'SELECT id, controle, estornado FROM mv_vendas WHERE id = ? FOR UPDATE',
        [id],
      )) as Array<{ id: number; controle: string | null; estornado: number | null }>;
      if (!venda || !venda.controle) throw new NotFoundException(`Venda #${id} não encontrada`);
      if (Number(venda.estornado) === 1) throw new ConflictException('Esta venda já foi estornada');

      const [pagas] = (await manager.query(
        `SELECT COUNT(*) AS total FROM mv_financeiro
          WHERE controle = ? AND origem_lancamento = ? AND efetuado = ? AND estornado = 0`,
        [venda.controle, ORIGEM_FINANCEIRO.CARNE, SIM],
      )) as Array<{ total: number | string }>;
      if (Number(pagas.total) > 0) {
        throw new ConflictException(
          'Venda com parcela de carnê já paga não pode ser estornada. Estorne o recebimento primeiro.',
        );
      }

      const itens = (await manager.query(
        `SELECT m.id_produto, m.quant, m.modo_venda, p.modo_estoque, p.nome_produto
           FROM mv_vendas_movimento m LEFT JOIN cad_produtos p ON p.id = m.id_produto
          WHERE m.controle = ? AND m.estornado = 0`,
        [venda.controle],
      )) as Array<{
        id_produto: number;
        quant: number | string;
        modo_venda: number;
        modo_estoque: number | null;
        nome_produto: string | null;
      }>;
      const trocas = (await manager.query(
        'SELECT id, id_produto, quantidade FROM mv_estoque_historico WHERE controle_venda = ? AND estornado = 0',
        [venda.controle],
      )) as Array<{ id: number; id_produto: number; quantidade: number | string }>;

      const devolver = agruparQuantidades(
        itens
          .filter(
            (item) =>
              Number(item.modo_venda) === MODO_VENDA.PRODUTO && Number(item.modo_estoque) === MODO_ESTOQUE.CONTROLA,
          )
          .map((item) => ({ idProduto: Number(item.id_produto), quantidade: numero(item.quant, 3) })),
      );
      const retirar = agruparQuantidades(
        trocas.map((troca) => ({ idProduto: Number(troca.id_produto), quantidade: numero(troca.quantidade, 3) })),
      );
      await bloquearSaldos(manager, [...devolver.keys(), ...retirar.keys()]);

      await manager.query('UPDATE mv_vendas SET estornado = 1, estornado_data = ? WHERE id = ?', [hoje, id]);
      await manager.query('UPDATE mv_vendas_movimento SET estornado = 1 WHERE controle = ?', [venda.controle]);
      await manager.query(
        'UPDATE mv_financeiro SET estornado = 1 WHERE controle = ? AND origem_lancamento IN (?, ?)',
        [venda.controle, ORIGEM_FINANCEIRO.VENDA, ORIGEM_FINANCEIRO.CARNE],
      );

      for (const [idProduto, quantidade] of devolver) {
        await creditarSaldo(manager, idProduto, quantidade);
      }
      for (const [idProduto, quantidade] of retirar) {
        await baixarSaldo(
          manager,
          idProduto,
          quantidade,
          `produto #${idProduto} recebido em troca (já foi vendido de novo)`,
        );
      }
      if (trocas.length) {
        await manager.query('UPDATE mv_estoque_historico SET estornado = 1 WHERE id IN (?)', [
          trocas.map((troca) => troca.id),
        ]);
      }
      return venda.controle;
    });
    return this.obterPorControle(controle);
  }

  async listar(filtro: ListarVendasDto): Promise<Paginado<VendaResumo>> {
    const condicoes = ['v.controle IS NOT NULL'];
    const parametros: unknown[] = [];
    if (!filtro.incluirEstornadas) condicoes.push('v.estornado = 0');
    if (filtro.inicio) {
      condicoes.push('v.data_venda >= ?');
      parametros.push(filtro.inicio);
    }
    if (filtro.fim) {
      condicoes.push('v.data_venda <= ?');
      parametros.push(filtro.fim);
    }
    if (filtro.idCliente !== undefined) {
      condicoes.push('v.id_cliente = ?');
      parametros.push(filtro.idCliente);
    }
    if (filtro.formaPagamento) condicoes.push(`v.${COLUNA_FORMA[filtro.formaPagamento]} > 0`);
    const where = `WHERE ${condicoes.join(' AND ')}`;
    const direcao = filtro.ordem === 'antigas' ? 'ASC' : 'DESC';

    const [linhas, [{ total }]] = await Promise.all([
      this.fonte.query(
        `${SELECT_VENDA} ${where} ORDER BY v.data_venda ${direcao}, v.controle ${direcao} LIMIT ? OFFSET ?`,
        [...parametros, filtro.limit, offset(filtro)],
      ) as Promise<LinhaVenda[]>,
      this.fonte.query(`SELECT COUNT(*) AS total FROM mv_vendas v ${where}`, parametros) as Promise<
        Array<{ total: number | string }>
      >,
    ]);
    return paginado(linhas.map(mapearVenda), Number(total), filtro.page, filtro.limit);
  }

  async obter(id: number): Promise<VendaDetalhe> {
    const [linha] = (await this.fonte.query(`${SELECT_VENDA} WHERE v.id = ?`, [id])) as LinhaVenda[];
    if (!linha || !linha.controle) throw new NotFoundException(`Venda #${id} não encontrada`);
    return this.detalhar(linha);
  }

  async obterPorControle(controle: string): Promise<VendaDetalhe> {
    const [linha] = (await this.fonte.query(`${SELECT_VENDA} WHERE v.controle = ?`, [controle])) as LinhaVenda[];
    if (!linha) throw new NotFoundException(`Venda ${controle} não encontrada`);
    return this.detalhar(linha);
  }

  private async detalhar(linha: LinhaVenda): Promise<VendaDetalhe> {
    const resumo = mapearVenda(linha);
    const [itens, parcelas] = await Promise.all([
      this.fonte.query(
        `SELECT m.id, m.id_produto, p.nome_produto, m.quant, m.valor, m.vr_total, m.modo_venda
           FROM mv_vendas_movimento m LEFT JOIN cad_produtos p ON p.id = m.id_produto
          WHERE m.controle = ? ORDER BY m.id`,
        [linha.controle],
      ) as Promise<Array<Record<string, unknown>>>,
      this.fonte.query(
        `SELECT cod_carne, parcela, data_vencimento, vr_parcela, efetuado, estornado, data_pagamento, vr_pago
           FROM mv_financeiro WHERE controle = ? AND origem_lancamento = ? ORDER BY parcela`,
        [linha.controle, ORIGEM_FINANCEIRO.CARNE],
      ) as Promise<Array<Record<string, unknown>>>,
    ]);

    const mapearItem = (item: Record<string, unknown>): ItemVendido => ({
      id: Number(item.id),
      idProduto: item.id_produto === null ? null : Number(item.id_produto),
      produto: (item.nome_produto as string | null) ?? `Produto removido (#${String(item.id_produto)})`,
      quantidade: numero(item.quant, 3),
      valorUnitario: numero(item.valor),
      valorTotal: numero(item.vr_total),
    });
    const vendidos = itens.filter((item) => Number(item.modo_venda) !== MODO_VENDA.TROCA).map(mapearItem);
    const trocados = itens.filter((item) => Number(item.modo_venda) === MODO_VENDA.TROCA).map(mapearItem);
    const somaCentavos = (lista: ItemVendido[]) =>
      paraReais(lista.reduce((total, item) => total + paraCentavos(item.valorTotal), 0));

    return {
      ...resumo,
      subtotalItens: somaCentavos(vendidos),
      creditoTroca: somaCentavos(trocados),
      itens: vendidos,
      itensTroca: trocados,
      parcelasCarne: parcelas.map((parcela) => ({
        codigo: (parcela.cod_carne as string | null) ?? null,
        parcela: Number(parcela.parcela),
        vencimento: (parcela.data_vencimento as string | null) ?? null,
        valor: numero(parcela.vr_parcela),
        situacao:
          Number(parcela.estornado) === 1 ? 'ESTORNADA' : parcela.efetuado === SIM ? 'PAGA' : 'ABERTA',
        dataPagamento: (parcela.data_pagamento as string | null) ?? null,
        valorPago: parcela.efetuado === SIM ? numero(parcela.vr_pago) : null,
      })),
    };
  }
}
