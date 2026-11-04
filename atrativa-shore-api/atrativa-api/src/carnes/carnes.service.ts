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
import type { BaixaCarneDto, ListarCarnesDto } from './dto/carne.dto.js';

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
}

export interface ResultadoBaixa {
  controleRecebimento: string;
  dataPagamento: string;
  valorTotal: number;
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

  async listar(filtro: ListarCarnesDto): Promise<Paginado<ParcelaCarne>> {
    const hoje = this.hoje();
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
    return paginado(linhas.map((linha) => this.mapear(linha, hoje)), Number(total), filtro.page, filtro.limit);
  }

  async obter(codigo: string): Promise<ParcelaCarne> {
    const [linha] = (await this.fonte.query(
      `${SELECT_PARCELA} WHERE f.cod_carne = ? AND f.origem_lancamento = 'C' AND f.estornado = 0 LIMIT 1`,
      [codigo],
    )) as Array<Record<string, unknown>>;
    if (!linha) throw new NotFoundException(`Parcela de carnê ${codigo} não encontrada`);
    return this.mapear(linha, this.hoje());
  }

  async baixar(dto: BaixaCarneDto, usuario: UsuarioAutenticado): Promise<ResultadoBaixa> {
    await this.banco.garantirTransacoes();
    const { terminal, turno, exigirCaixaAberto } = this.config.pdv;
    if (exigirCaixaAberto && !(await buscarCaixaAberto(this.fonte, terminal))) {
      throw new ConflictException(`Abra o caixa do terminal ${terminal} antes de receber carnês`);
    }
    const hoje = this.hoje();
    const dataPagamento = dto.dataPagamento ?? hoje;
    if (!dataIsoValida(dataPagamento) || dataPagamento > hoje) {
      throw new BadRequestException('dataPagamento deve ser uma data válida, até hoje');
    }
    const codigos = dto.parcelas.map((parcela) => parcela.codigo);
    if (new Set(codigos).size !== codigos.length) {
      throw new BadRequestException('A mesma parcela foi informada mais de uma vez');
    }

    const controle = await this.fonte.transaction('READ COMMITTED', async (manager) => {
      const linhas = (await manager.query(
        `SELECT id, cod_carne, vr_parcela, efetuado, estornado FROM mv_financeiro
          WHERE cod_carne IN (?) AND origem_lancamento = ? FOR UPDATE`,
        [codigos, ORIGEM_FINANCEIRO.CARNE],
      )) as Array<{ id: number; cod_carne: string; vr_parcela: number | string; efetuado: string; estornado: number }>;
      const porCodigo = new Map(linhas.filter((l) => Number(l.estornado) === 0).map((l) => [l.cod_carne, l]));

      const valores: number[] = [];
      for (const parcela of dto.parcelas) {
        const linha = porCodigo.get(parcela.codigo);
        if (!linha) throw new NotFoundException(`Parcela ${parcela.codigo} não encontrada ou estornada`);
        if (linha.efetuado === SIM) throw new ConflictException(`A parcela ${parcela.codigo} já está paga`);

        const juros = paraCentavos(parcela.juros ?? 0);
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
      return controleRecebimento;
    });

    const parcelas = await Promise.all(codigos.map((codigo) => this.obter(codigo)));
    return {
      controleRecebimento: controle,
      dataPagamento,
      valorTotal: paraReais(somar(parcelas.map((parcela) => paraCentavos(parcela.valorPago ?? 0)))),
      parcelas,
    };
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

  private mapear(linha: Record<string, unknown>, hoje: string): ParcelaCarne {
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
    };
  }
}
