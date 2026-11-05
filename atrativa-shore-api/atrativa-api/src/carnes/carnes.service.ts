import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { idLoginDe, type UsuarioAutenticado } from '../auth/usuario-autenticado.js';
import { buscarCaixaAberto } from '../caixa/consultas-caixa.js';
import { ConfiguracaoService } from '../config/configuracao.service.js';
import {
  ID_CONSUMIDOR_NAO_IDENTIFICADO,
  MODO_ESTOQUE,
  MODO_LANCAMENTO,
  MODO_VENDA,
  NAO,
  ORIGEM_FINANCEIRO,
  SIM,
} from '../common/constantes/legado.js';
import { offset, paginado, type Paginado } from '../common/dto/paginacao.dto.js';
import { controleDisponivel } from '../common/utils/controle.js';
import { dataIsoValida, dataNoFuso } from '../common/utils/datas.js';
import { paraCentavos, paraReais, somar } from '../common/utils/dinheiro.js';
import { numero, numeroOuNulo } from '../common/utils/transformadores.js';
import { VerificacaoBancoService } from '../database/verificacao-banco.service.js';
import { VendaItem } from '../vendas/entities/venda-item.entity.js';
import type { BaixaCarneDto, ConfigCarneDto, ListarCarnesDto, SimularBaixaDto } from './dto/carne.dto.js';
import { FormaRecebimentoCarne } from './dto/carne.dto.js';
import { CONFIG_CARNE_PADRAO, calcularEncargos, type ConfigCarne, type Encargos } from './encargos.js';

export interface ParcelaCarne {
  id: number;
  codigo: string | null;
  controleVenda: string | null;
  cliente: { id: number; nome: string | null; telefone: string | null; celular: string | null } | null;
  parcela: number;
  totalParcelas: number;
  numeroParcela: string;
  dataCompra: string | null;
  vencimento: string | null;
  valorParcela: number;
  valorTotalCompra: number | null;
  valorParcelado: number | null;
  situacao: 'ABERTA' | 'PAGA';
  atrasada: boolean;
  dataPagamento: string | null;
  valorPago: number | null;
  juros: number | null;
  desconto: number | null;
  encargos: Encargos | null;
}

export interface PagamentosRecebimento {
  dinheiro: number;
  pix: number;
  cartao: number;
}

export interface ResultadoBaixa {
  controleRecebimento: string;
  dataPagamento: string;
  valorTotal: number;
  pagamentos: PagamentosRecebimento;
  troco: number;
  parcelas: ParcelaCarne[];
}

export interface SimulacaoBaixa {
  dataPagamento: string;
  config: ConfigCarne;
  parcelas: Array<{ codigo: string; numeroParcela: string; vencimento: string | null; valorParcela: number } & Encargos>;
  total: number;
}

export interface ImpressaoCarne {
  empresa: {
    nome: string | null;
    cnpj: string | null;
    endereco: string | null;
    bairro: string | null;
    cidade: string | null;
    uf: string | null;
    telefone: string | null;
  };
  config: ConfigCarne;
  venda: { id: number | null; controle: string; data: string | null; valorTotal: number | null; valorParcelado: number | null };
  cliente: { id: number; nome: string | null; documento: string | null } | null;
  parcelas: ParcelaCarne[];
}

const SELECT_PARCELA = `
  SELECT f.id, f.cod_carne, f.controle, f.id_cliente, c.nome_cliente, c.telefone, c.celular, f.parcela,
         COALESCE(t.total, 1) AS total_parcelas, f.data_lancamento, f.data_vencimento, f.vr_parcela,
         f.efetuado, f.data_pagamento, f.vr_pago, f.vr_juros, f.vr_desconto, v.vr_total, v.vr_carne
    FROM mv_financeiro f
    LEFT JOIN cad_clientes c ON c.id = f.id_cliente
    LEFT JOIN mv_vendas v ON v.controle = f.controle
    LEFT JOIN (SELECT controle, COUNT(*) AS total FROM mv_financeiro
                WHERE origem_lancamento = 'C' GROUP BY controle) t ON t.controle = f.controle`;

@Injectable()
export class CarnesService {
  constructor(
    private readonly fonte: DataSource,
    private readonly config: ConfiguracaoService,
    private readonly banco: VerificacaoBancoService,
  ) {}

  async configuracao(): Promise<ConfigCarne> {
    const [linha] = (await this.fonte
      .query('SELECT juros_dia, multa, carencia_dias FROM api_config_carne WHERE id = 1')
      .catch(() => [])) as Array<Record<string, unknown>>;
    if (!linha) return { ...CONFIG_CARNE_PADRAO };
    return { jurosDia: numero(linha.juros_dia), multa: numero(linha.multa), carenciaDias: Number(linha.carencia_dias ?? 0) };
  }

  async atualizarConfiguracao(dto: ConfigCarneDto): Promise<ConfigCarne> {
    await this.banco.garantirTabelasCarne();
    await this.fonte.query(
      `INSERT INTO api_config_carne (id, juros_dia, multa, carencia_dias) VALUES (1, ?, ?, ?)
       ON DUPLICATE KEY UPDATE juros_dia = VALUES(juros_dia), multa = VALUES(multa), carencia_dias = VALUES(carencia_dias)`,
      [dto.jurosDia, dto.multa, dto.carenciaDias],
    );
    return this.configuracao();
  }

  async simular(dto: SimularBaixaDto): Promise<SimulacaoBaixa> {
    const hoje = this.hoje();
    const dataPagamento = this.validarData(dto.dataPagamento ?? hoje, hoje);
    if (new Set(dto.codigos).size !== dto.codigos.length) throw new BadRequestException('A mesma parcela foi informada mais de uma vez');
    const config = await this.configuracao();
    const parcelas = await Promise.all(dto.codigos.map((codigo) => this.obter(codigo)));
    const calculadas = parcelas.map((parcela) => {
      if (parcela.situacao === 'PAGA') throw new ConflictException(`A parcela ${parcela.codigo} já está paga`);
      return {
        codigo: parcela.codigo!,
        numeroParcela: parcela.numeroParcela,
        vencimento: parcela.vencimento,
        valorParcela: parcela.valorParcela,
        ...calcularEncargos(parcela.valorParcela, parcela.vencimento, dataPagamento, config),
      };
    });
    return { dataPagamento, config, parcelas: calculadas, total: paraReais(somar(calculadas.map((p) => paraCentavos(p.total)))) };
  }

  async impressao(controle: string): Promise<ImpressaoCarne> {
    const hoje = this.hoje();
    const config = await this.configuracao();
    const linhas = (await this.fonte.query(
      `${SELECT_PARCELA} WHERE f.controle = ? AND f.origem_lancamento = 'C' AND f.estornado = 0 ORDER BY f.parcela ASC`,
      [controle],
    )) as Array<Record<string, unknown>>;
    if (!linhas.length) throw new NotFoundException(`Carnê da venda ${controle} não encontrado`);
    const parcelas = linhas.map((linha) => this.mapear(linha, hoje, config));
    const [[empresa], [venda]] = (await Promise.all([
      this.fonte.query('SELECT nome_empresa, cnpj, endereco, bairro, cidade, uf, telefone FROM cad_empresa ORDER BY id LIMIT 1'),
      this.fonte.query(
        `SELECT v.id, v.data_venda, v.vr_total, v.vr_carne, c.id AS id_cliente, c.nome_cliente, c.cpf
           FROM mv_vendas v LEFT JOIN cad_clientes c ON c.id = v.id_cliente WHERE v.controle = ? LIMIT 1`,
        [controle],
      ),
    ])) as Array<Array<Record<string, unknown> | undefined>>;
    const texto = (valor: unknown) => (valor === null || valor === undefined || String(valor).trim() === '' ? null : String(valor).trim());
    const idCliente = Number(venda?.id_cliente ?? parcelas[0].cliente?.id ?? 0);
    return {
      empresa: {
        nome: texto(empresa?.nome_empresa),
        cnpj: texto(empresa?.cnpj),
        endereco: texto(empresa?.endereco),
        bairro: texto(empresa?.bairro),
        cidade: texto(empresa?.cidade),
        uf: texto(empresa?.uf),
        telefone: texto(empresa?.telefone),
      },
      config,
      venda: {
        id: venda?.id ? Number(venda.id) : null,
        controle,
        data: (venda?.data_venda as string | undefined) ?? parcelas[0].dataCompra,
        valorTotal: numeroOuNulo(venda?.vr_total),
        valorParcelado: numeroOuNulo(venda?.vr_carne),
      },
      cliente:
        idCliente > 0
          ? { id: idCliente, nome: texto(venda?.nome_cliente) ?? parcelas[0].cliente?.nome ?? null, documento: texto(venda?.cpf) }
          : null,
      parcelas,
    };
  }

  async listar(filtro: ListarCarnesDto): Promise<Paginado<ParcelaCarne>> {
    const hoje = this.hoje();
    const config = await this.configuracao();
    const condicoes = ["f.origem_lancamento = 'C'", 'f.estornado = 0'];
    const parametros: unknown[] = [];
    const situacao = filtro.vencidas ? 'ABERTA' : (filtro.situacao ?? 'ABERTA');
    if (situacao !== 'TODAS') {
      condicoes.push('f.efetuado = ?');
      parametros.push(situacao === 'PAGA' ? SIM : NAO);
    }
    if (filtro.vencidas) {
      condicoes.push('f.data_vencimento < ?');
      parametros.push(hoje);
    }
    if (filtro.idCliente) {
      condicoes.push('f.id_cliente = ?');
      parametros.push(filtro.idCliente);
    }
    if (filtro.inicio) {
      condicoes.push('f.data_vencimento >= ?');
      parametros.push(filtro.inicio);
    }
    if (filtro.fim) {
      condicoes.push('f.data_vencimento <= ?');
      parametros.push(filtro.fim);
    }
    const where = `WHERE ${condicoes.join(' AND ')}`;
    const [linhas, [{ total }]] = await Promise.all([
      this.fonte.query(
        `${SELECT_PARCELA} ${where} ORDER BY f.data_vencimento ASC, f.controle ASC, f.parcela ASC LIMIT ? OFFSET ?`,
        [...parametros, filtro.limit, offset(filtro)],
      ) as Promise<Array<Record<string, unknown>>>,
      this.fonte.query(`SELECT COUNT(*) AS total FROM mv_financeiro f ${where}`, parametros) as Promise<
        Array<{ total: number | string }>
      >,
    ]);
    return paginado(linhas.map((linha) => this.mapear(linha, hoje, config)), Number(total), filtro.page, filtro.limit);
  }

  async obter(codigo: string): Promise<ParcelaCarne> {
    const [linha] = (await this.fonte.query(
      `${SELECT_PARCELA} WHERE f.cod_carne = ? AND f.origem_lancamento = 'C' AND f.estornado = 0 LIMIT 1`,
      [codigo],
    )) as Array<Record<string, unknown>>;
    if (!linha) throw new NotFoundException(`Parcela de carnê ${codigo} não encontrada`);
    return this.mapear(linha, this.hoje(), await this.configuracao());
  }

  async baixar(dto: BaixaCarneDto, usuario: UsuarioAutenticado): Promise<ResultadoBaixa> {
    await this.banco.garantirTransacoes();
    await this.banco.garantirTabelasCarne();
    const { terminal, turno, exigirCaixaAberto } = this.config.pdv;
    if (exigirCaixaAberto && !(await buscarCaixaAberto(this.fonte, terminal))) {
      throw new ConflictException(`Abra o caixa do terminal ${terminal} antes de receber carnês`);
    }
    const hoje = this.hoje();
    const dataPagamento = this.validarData(dto.dataPagamento ?? hoje, hoje);
    const codigos = dto.parcelas.map((parcela) => parcela.codigo);
    if (new Set(codigos).size !== codigos.length) {
      throw new BadRequestException('A mesma parcela foi informada mais de uma vez');
    }
    const formas = (dto.pagamentos ?? []).map((p) => p.forma);
    if (new Set(formas).size !== formas.length) throw new BadRequestException('Forma de pagamento repetida');
    const config = await this.configuracao();

    const resultado = await this.fonte.transaction('READ COMMITTED', async (manager) => {
      const linhas = (await manager.query(
        `SELECT id, cod_carne, vr_parcela, data_vencimento, efetuado, estornado FROM mv_financeiro
          WHERE cod_carne IN (?) AND origem_lancamento = ? FOR UPDATE`,
        [codigos, ORIGEM_FINANCEIRO.CARNE],
      )) as Array<{
        id: number;
        cod_carne: string;
        vr_parcela: number | string;
        data_vencimento: string | null;
        efetuado: string;
        estornado: number;
      }>;
      const porCodigo = new Map(linhas.filter((l) => Number(l.estornado) === 0).map((l) => [l.cod_carne, l]));

      const valores: number[] = [];
      for (const parcela of dto.parcelas) {
        const linha = porCodigo.get(parcela.codigo);
        if (!linha) throw new NotFoundException(`Parcela ${parcela.codigo} não encontrada ou estornada`);
        if (linha.efetuado === SIM) throw new ConflictException(`A parcela ${parcela.codigo} já está paga`);

        const automatico = calcularEncargos(numero(linha.vr_parcela), linha.data_vencimento, dataPagamento, config);
        const juros = paraCentavos(parcela.juros ?? automatico.juros + automatico.multa);
        const desconto = paraCentavos(parcela.desconto ?? 0);
        const valorPago = paraCentavos(linha.vr_parcela) + juros - desconto;
        if (valorPago <= 0) {
          throw new BadRequestException(`O desconto da parcela ${parcela.codigo} não pode zerar o pagamento`);
        }
        valores.push(valorPago);
        await manager.query(
          `UPDATE mv_financeiro SET efetuado = ?, data_pagamento = ?, vr_pago = ?, vr_juros = ?, vr_desconto = ?
            WHERE id = ?`,
          [SIM, dataPagamento, paraReais(valorPago), juros ? paraReais(juros) : null, desconto ? paraReais(desconto) : null, linha.id],
        );
      }

      const total = somar(valores);
      const porForma = { dinheiro: 0, pix: 0, cartao: 0 };
      if (!dto.pagamentos?.length) porForma.dinheiro = total;
      for (const pagamento of dto.pagamentos ?? []) {
        const chave = pagamento.forma === FormaRecebimentoCarne.PIX ? 'pix' : pagamento.forma === FormaRecebimentoCarne.CARTAO ? 'cartao' : 'dinheiro';
        porForma[chave] = paraCentavos(pagamento.valor);
      }
      const pago = somar([porForma.dinheiro, porForma.pix, porForma.cartao]);
      if (pago !== total) {
        throw new BadRequestException(
          `A soma dos pagamentos (R$ ${paraReais(pago).toFixed(2)}) deve ser igual ao total a receber (R$ ${paraReais(total).toFixed(2)})`,
        );
      }
      let troco = 0;
      if (dto.valorRecebidoDinheiro !== undefined) {
        const recebido = paraCentavos(dto.valorRecebidoDinheiro);
        if (recebido < porForma.dinheiro) {
          throw new BadRequestException('O valor recebido em dinheiro é menor que a parte paga em dinheiro');
        }
        troco = recebido - porForma.dinheiro;
      }

      const controleRecebimento = await controleDisponivel(manager, this.config.fusoHorario, [
        'mv_vendas',
        'mv_vendas_movimento',
      ]);
      await manager.insert(VendaItem, {
        controle: controleRecebimento,
        dataVenda: hoje,
        idLogin: idLoginDe(usuario),
        idProduto: await this.produtoRecebimento(manager),
        valorUnitario: paraReais(total),
        quantidade: 1,
        valorTotal: paraReais(total),
        modoVenda: MODO_VENDA.RECEBIMENTO_CARNE,
        idCliente: ID_CONSUMIDOR_NAO_IDENTIFICADO,
        estornado: 0,
        terminal,
        turno,
        modoLancamento: MODO_LANCAMENTO.PADRAO,
        idGrade: 0,
      });
      await manager.query(
        `INSERT INTO api_recebimentos_carne
           (controle, data_recebimento, terminal, turno, id_login, vr_total, vr_dinheiro, vr_pix, vr_cartao,
            vr_recebido_dinheiro, vr_troco, parcelas)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          controleRecebimento,
          hoje,
          terminal,
          turno,
          idLoginDe(usuario),
          paraReais(total),
          paraReais(porForma.dinheiro),
          paraReais(porForma.pix),
          paraReais(porForma.cartao),
          dto.valorRecebidoDinheiro ?? null,
          paraReais(troco),
          codigos.join(','),
        ],
      );
      return {
        controle: controleRecebimento,
        pagamentos: { dinheiro: paraReais(porForma.dinheiro), pix: paraReais(porForma.pix), cartao: paraReais(porForma.cartao) },
        troco: paraReais(troco),
      };
    });

    const parcelas = await Promise.all(codigos.map((codigo) => this.obter(codigo)));
    return {
      controleRecebimento: resultado.controle,
      dataPagamento,
      valorTotal: paraReais(somar(parcelas.map((parcela) => paraCentavos(parcela.valorPago ?? 0)))),
      pagamentos: resultado.pagamentos,
      troco: resultado.troco,
      parcelas,
    };
  }

  private validarData(data: string, hoje: string): string {
    if (!dataIsoValida(data) || data > hoje) {
      throw new BadRequestException('dataPagamento deve ser uma data válida, até hoje');
    }
    return data;
  }

  private async produtoRecebimento(manager: EntityManager): Promise<number> {
    const [linha] = (await manager.query(
      `SELECT id FROM cad_produtos WHERE modo_estoque = ?
        ORDER BY (nome_produto LIKE 'RECEBIMENTO%') DESC, id DESC LIMIT 1`,
      [MODO_ESTOQUE.SERVICO],
    )) as Array<{ id: number }>;
    if (!linha) {
      throw new InternalServerErrorException(
        'Produto de serviço "RECEBIMENTO DE CARNÊ" (modo_estoque = 6) não encontrado em cad_produtos',
      );
    }
    return Number(linha.id);
  }

  private hoje(): string {
    return dataNoFuso(new Date(), this.config.fusoHorario);
  }

  private mapear(linha: Record<string, unknown>, hoje: string, config: ConfigCarne): ParcelaCarne {
    const paga = linha.efetuado === SIM;
    const vencimento = (linha.data_vencimento as string | null) ?? null;
    const parcela = Number(linha.parcela);
    const totalParcelas = Number(linha.total_parcelas);
    const idCliente = Number(linha.id_cliente ?? 0);
    return {
      id: Number(linha.id),
      codigo: (linha.cod_carne as string | null) ?? null,
      controleVenda: (linha.controle as string | null) ?? null,
      cliente:
        idCliente > 0
          ? {
              id: idCliente,
              nome: (linha.nome_cliente as string | null) ?? null,
              telefone: (linha.telefone as string | null) ?? null,
              celular: (linha.celular as string | null) ?? null,
            }
          : null,
      parcela,
      totalParcelas,
      numeroParcela: `${parcela}/${totalParcelas}`,
      dataCompra: (linha.data_lancamento as string | null) ?? null,
      vencimento,
      valorParcela: numero(linha.vr_parcela),
      valorTotalCompra: numeroOuNulo(linha.vr_total),
      valorParcelado: numeroOuNulo(linha.vr_carne),
      situacao: paga ? 'PAGA' : 'ABERTA',
      atrasada: !paga && vencimento !== null && vencimento < hoje,
      dataPagamento: (linha.data_pagamento as string | null) ?? null,
      valorPago: paga ? numero(linha.vr_pago) : null,
      juros: numeroOuNulo(linha.vr_juros),
      desconto: numeroOuNulo(linha.vr_desconto),
      encargos: paga ? null : calcularEncargos(numero(linha.vr_parcela), vencimento, hoje, config),
    };
  }
}
