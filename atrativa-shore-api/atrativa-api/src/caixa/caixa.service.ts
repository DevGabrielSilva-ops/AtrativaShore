import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { idLoginDe, type UsuarioAutenticado } from '../auth/usuario-autenticado.js';
import { ConfiguracaoService } from '../config/configuracao.service.js';
import { MODO_VENDA, STATUS_CAIXA } from '../common/constantes/legado.js';
import { offset, paginado, type PaginacaoDto, type Paginado } from '../common/dto/paginacao.dto.js';
import { dataNoFuso, horaDoControle, horaNoFuso } from '../common/utils/datas.js';
import { paraCentavos, paraReais, somar } from '../common/utils/dinheiro.js';
import { numero, numeroOuNulo } from '../common/utils/transformadores.js';
import type { AbrirCaixaDto, FecharCaixaDto } from './dto/caixa.dto.js';
import { buscarCaixaAberto, type LinhaCaixa } from './consultas-caixa.js';
import { FechamentoCaixa } from './entities/fechamento-caixa.entity.js';

export interface Caixa {
  id: number;
  terminal: string | null;
  turno: string | null;
  aberto: boolean;
  idLogin: number | null;
  abertura: { data: string | null; hora: string | null; valor: number | null };
  fechamento: { data: string | null; hora: string | null; valor: number | null };
}

export interface MovimentoCaixa {
  tipo: 'VENDA' | 'RECEBIMENTO_CARNE';
  controle: string | null;
  data: string | null;
  hora: string | null;
  descricao: string;
  valor: number;
}

export interface ResumoCaixa {
  periodo: { inicio: string; fim: string };
  quantidadeVendas: number;
  vendas: { dinheiro: number; pix: number; cartao: number; carne: number; outros: number; total: number };
  descontos: number;
  recebimentosCarne: { quantidade: number; total: number; dinheiro: number; pix: number; cartao: number };
  entradas: { dinheiro: number; pix: number; cartao: number; outros: number; total: number };
  totalRecebido: number;
  dinheiroEsperadoNaGaveta: number;
  movimentos: MovimentoCaixa[];
}

function mapearCaixa(linha: LinhaCaixa): Caixa {
  return {
    id: Number(linha.id),
    terminal: linha.terminal,
    turno: linha.turno,
    aberto: linha.status_caixa === STATUS_CAIXA.ABERTO,
    idLogin: linha.id_login === null ? null : Number(linha.id_login),
    abertura: { data: linha.data_abertura, hora: linha.hora_abertura, valor: numeroOuNulo(linha.vr_abertura) },
    fechamento: {
      data: linha.data_fechamento,
      hora: linha.hora_fechamento,
      valor: numeroOuNulo(linha.vr_fechamento),
    },
  };
}

@Injectable()
export class CaixaService {
  constructor(
    private readonly fonte: DataSource,
    private readonly config: ConfiguracaoService,
  ) {}

  async atual(): Promise<(Caixa & { resumo: ResumoCaixa }) | null> {
    const linha = await buscarCaixaAberto(this.fonte, this.config.pdv.terminal);
    if (!linha) return null;
    const caixa = mapearCaixa(linha);
    return { ...caixa, resumo: await this.resumo(caixa) };
  }

  async abrir(dto: AbrirCaixaDto, usuario: UsuarioAutenticado): Promise<Caixa & { resumo: ResumoCaixa }> {
    const { terminal, turno } = this.config.pdv;
    if (await buscarCaixaAberto(this.fonte, terminal)) {
      throw new ConflictException(`Já existe um caixa aberto no terminal ${terminal}`);
    }
    const agora = new Date();
    await this.fonte.getRepository(FechamentoCaixa).insert({
      dataAbertura: dataNoFuso(agora, this.config.fusoHorario),
      horaAbertura: horaNoFuso(agora, this.config.fusoHorario),
      dataFechamento: null,
      horaFechamento: null,
      valorAbertura: dto.valorAbertura,
      valorFechamento: null,
      idLogin: idLoginDe(usuario),
      turno,
      terminal,
      status: STATUS_CAIXA.ABERTO,
    });
    return (await this.atual())!;
  }

  async fechar(
    dto: FecharCaixaDto,
  ): Promise<Caixa & { resumo: ResumoCaixa; valorProximoDia: number | null }> {
    const linha = await buscarCaixaAberto(this.fonte, this.config.pdv.terminal);
    if (!linha) throw new ConflictException('Nenhum caixa aberto neste terminal');
    const resumo = await this.resumo(mapearCaixa(linha));
    const agora = new Date();
    await this.fonte.getRepository(FechamentoCaixa).update(
      { id: linha.id },
      {
        dataFechamento: dataNoFuso(agora, this.config.fusoHorario),
        horaFechamento: horaNoFuso(agora, this.config.fusoHorario),
        valorFechamento: resumo.totalRecebido,
        status: STATUS_CAIXA.FECHADO,
      },
    );
    const fechado = await this.obterLinha(linha.id);
    return { ...mapearCaixa(fechado), resumo, valorProximoDia: dto.valorProximoDia ?? null };
  }

  async obter(id: number): Promise<Caixa & { resumo: ResumoCaixa }> {
    const caixa = mapearCaixa(await this.obterLinha(id));
    return { ...caixa, resumo: await this.resumo(caixa) };
  }

  async historico(paginacao: PaginacaoDto): Promise<Paginado<Caixa>> {
    const terminal = this.config.pdv.terminal;
    const [linhas, [{ total }]] = await Promise.all([
      this.fonte.query(
        `SELECT id, data_abertura, hora_abertura, data_fechamento, hora_fechamento, vr_abertura, vr_fechamento,
                id_login, turno, terminal, status_caixa
           FROM mv_fechamento WHERE terminal = ? ORDER BY id DESC LIMIT ? OFFSET ?`,
        [terminal, paginacao.limit, offset(paginacao)],
      ) as Promise<LinhaCaixa[]>,
      this.fonte.query('SELECT COUNT(*) AS total FROM mv_fechamento WHERE terminal = ?', [terminal]) as Promise<
        Array<{ total: number | string }>
      >,
    ]);
    return paginado(linhas.map(mapearCaixa), Number(total), paginacao.page, paginacao.limit);
  }

  private async temFormasNoCarne(): Promise<boolean> {
    const linhas = (await this.fonte.query(
      "SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'api_recebimentos_carne'",
    )) as unknown[];
    return linhas.length > 0;
  }

  async resumo(caixa: Caixa): Promise<ResumoCaixa> {
    const comFormas = await this.temFormasNoCarne();
    const inicio = caixa.abertura.data ?? dataNoFuso(new Date(), this.config.fusoHorario);
    const fim = caixa.aberto || !caixa.fechamento.data
      ? dataNoFuso(new Date(), this.config.fusoHorario)
      : caixa.fechamento.data;
    const terminal = caixa.terminal;

    const [[totais], [recebimentos], vendas, itensRecebimento] = await Promise.all([
      this.fonte.query(
        `SELECT COUNT(*) AS quantidade, SUM(vr_dinheiro) AS dinheiro, SUM(vr_pix) AS pix, SUM(vr_cartao) AS cartao,
                SUM(vr_carne) AS carne, SUM(COALESCE(vr_cheque, 0) + COALESCE(vr_ticket, 0)) AS outros,
                SUM(vr_adicional) AS descontos
           FROM mv_vendas
          WHERE terminal = ? AND estornado = 0 AND controle IS NOT NULL AND data_venda BETWEEN ? AND ?`,
        [terminal, inicio, fim],
      ) as Promise<Array<Record<string, unknown>>>,
      this.fonte.query(
        `SELECT COUNT(*) AS quantidade, SUM(m.vr_total) AS total,
                SUM(${comFormas ? 'COALESCE(r.vr_dinheiro, m.vr_total)' : 'm.vr_total'}) AS dinheiro,
                SUM(${comFormas ? 'COALESCE(r.vr_pix, 0)' : '0'}) AS pix,
                SUM(${comFormas ? 'COALESCE(r.vr_cartao, 0)' : '0'}) AS cartao
           FROM mv_vendas_movimento m
           ${comFormas ? 'LEFT JOIN api_recebimentos_carne r ON r.controle = m.controle' : ''}
          WHERE m.terminal = ? AND m.estornado = 0 AND m.modo_venda = ? AND m.data_venda BETWEEN ? AND ?`,
        [terminal, MODO_VENDA.RECEBIMENTO_CARNE, inicio, fim],
      ) as Promise<Array<Record<string, unknown>>>,
      this.fonte.query(
        `SELECT v.controle, v.data_venda, v.vr_total, c.nome_cliente
           FROM mv_vendas v LEFT JOIN cad_clientes c ON c.id = v.id_cliente
          WHERE v.terminal = ? AND v.estornado = 0 AND v.controle IS NOT NULL AND v.data_venda BETWEEN ? AND ?
          ORDER BY v.controle DESC LIMIT 300`,
        [terminal, inicio, fim],
      ) as Promise<Array<Record<string, unknown>>>,
      this.fonte.query(
        `SELECT m.controle, m.data_venda, m.vr_total${comFormas ? ', r.vr_dinheiro, r.vr_pix, r.vr_cartao' : ''}
           FROM mv_vendas_movimento m
           ${comFormas ? 'LEFT JOIN api_recebimentos_carne r ON r.controle = m.controle' : ''}
          WHERE m.terminal = ? AND m.estornado = 0 AND m.modo_venda = ? AND m.data_venda BETWEEN ? AND ?
          ORDER BY m.controle DESC LIMIT 300`,
        [terminal, MODO_VENDA.RECEBIMENTO_CARNE, inicio, fim],
      ) as Promise<Array<Record<string, unknown>>>,
    ]);

    const centavos = (valor: unknown) => paraCentavos(numero(valor));
    const dinheiro = centavos(totais.dinheiro);
    const pix = centavos(totais.pix);
    const cartao = centavos(totais.cartao);
    const carne = centavos(totais.carne);
    const outros = centavos(totais.outros);
    const recebido = centavos(recebimentos.total);
    const recebidoDinheiro = centavos(recebimentos.dinheiro);
    const recebidoPix = centavos(recebimentos.pix);
    const recebidoCartao = centavos(recebimentos.cartao);
    const formasDoRecebimento = (item: Record<string, unknown>) => {
      const nomes: string[] = [];
      if (centavos(item.vr_pix) > 0) nomes.push('Pix');
      if (centavos(item.vr_cartao) > 0) nomes.push('cartão');
      if (item.vr_dinheiro === undefined || item.vr_dinheiro === null || centavos(item.vr_dinheiro) > 0) nomes.unshift('dinheiro');
      return nomes.join(' + ');
    };

    const movimentos: MovimentoCaixa[] = [
      ...vendas.map((venda) => ({
        tipo: 'VENDA' as const,
        controle: venda.controle as string,
        data: venda.data_venda as string,
        hora: horaDoControle(venda.controle as string),
        descricao: `Venda${venda.nome_cliente ? ` - ${String(venda.nome_cliente)}` : ''}`,
        valor: numero(venda.vr_total),
      })),
      ...itensRecebimento.map((item) => ({
        tipo: 'RECEBIMENTO_CARNE' as const,
        controle: item.controle as string,
        data: item.data_venda as string,
        hora: horaDoControle(item.controle as string),
        descricao: `Recebimento de carnê (${formasDoRecebimento(item)})`,
        valor: numero(item.vr_total),
      })),
    ].sort((a, b) => String(b.controle).localeCompare(String(a.controle)));

    return {
      periodo: { inicio, fim },
      quantidadeVendas: Number(totais.quantidade ?? 0),
      vendas: {
        dinheiro: paraReais(dinheiro),
        pix: paraReais(pix),
        cartao: paraReais(cartao),
        carne: paraReais(carne),
        outros: paraReais(outros),
        total: paraReais(somar([dinheiro, pix, cartao, carne, outros])),
      },
      descontos: numero(totais.descontos),
      recebimentosCarne: {
        quantidade: Number(recebimentos.quantidade ?? 0),
        total: paraReais(recebido),
        dinheiro: paraReais(recebidoDinheiro),
        pix: paraReais(recebidoPix),
        cartao: paraReais(recebidoCartao),
      },
      entradas: {
        dinheiro: paraReais(dinheiro + recebidoDinheiro),
        pix: paraReais(pix + recebidoPix),
        cartao: paraReais(cartao + recebidoCartao),
        outros: paraReais(outros),
        total: paraReais(somar([dinheiro, pix, cartao, outros, recebido])),
      },
      totalRecebido: paraReais(somar([dinheiro, pix, cartao, outros, recebido])),
      dinheiroEsperadoNaGaveta: paraReais(
        somar([paraCentavos(caixa.abertura.valor ?? 0), dinheiro, recebidoDinheiro]),
      ),
      movimentos,
    };
  }

  private async obterLinha(id: number): Promise<LinhaCaixa> {
    const [linha] = (await this.fonte.query(
      `SELECT id, data_abertura, hora_abertura, data_fechamento, hora_fechamento, vr_abertura, vr_fechamento,
              id_login, turno, terminal, status_caixa FROM mv_fechamento WHERE id = ?`,
      [id],
    )) as LinhaCaixa[];
    if (!linha) throw new NotFoundException(`Caixa #${id} não encontrado`);
    return linha;
  }
}
