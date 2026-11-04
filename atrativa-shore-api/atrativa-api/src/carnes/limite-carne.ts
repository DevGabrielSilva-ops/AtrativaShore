import { ConflictException } from '@nestjs/common';
import type { DataSource, EntityManager } from 'typeorm';
import { NAO, ORIGEM_FINANCEIRO } from '../common/constantes/legado.js';
import { type Centavos, formatarReais, paraCentavos, paraReais } from '../common/utils/dinheiro.js';

/**
 * Limite de compras no carnê por cliente.
 *
 * O limite vale para o total de parcelas EM ABERTO do cliente (não pagas e
 * não estornadas). Pagar parcelas libera o limite na mesma hora, porque o
 * saldo é sempre recalculado a partir de mv_financeiro.
 *
 * De onde vem o limite, nesta ordem:
 *  1. MANUAL: cad_clientes.limite_carne preenchido (exceção por cliente);
 *  2. RENDA:  faixa salarial × CARNE_LIMITE_PERCENTUAL_RENDA %;
 *  3. PADRAO: CARNE_LIMITE_PADRAO, para quem não tem renda cadastrada.
 */
export type OrigemLimiteCarne = 'MANUAL' | 'RENDA' | 'PADRAO';

export interface RegraLimiteCarne {
  /** Percentual da faixa salarial (ex.: 50 = metade da renda). */
  percentualRenda: number;
  /** Limite em reais para clientes sem faixa salarial. */
  limitePadrao: number;
}

export interface CreditoCarne {
  idCliente: number;
  limite: number;
  origem: OrigemLimiteCarne;
  emAberto: number;
  disponivel: number;
  faixaSalarial: number | null;
  percentualRenda: number;
}

interface DadosLimite {
  limiteCarne: number | null;
  faixaSalarial: number | null;
}

export function calcularLimiteCarne(
  cliente: DadosLimite,
  regra: RegraLimiteCarne,
): { limite: Centavos; origem: OrigemLimiteCarne } {
  if (cliente.limiteCarne !== null && cliente.limiteCarne !== undefined) {
    return { limite: paraCentavos(cliente.limiteCarne), origem: 'MANUAL' };
  }
  if (cliente.faixaSalarial && cliente.faixaSalarial > 0) {
    // Arredonda para baixo: o limite nunca passa do percentual da renda.
    return { limite: Math.floor((paraCentavos(cliente.faixaSalarial) * regra.percentualRenda) / 100), origem: 'RENDA' };
  }
  return { limite: paraCentavos(regra.limitePadrao), origem: 'PADRAO' };
}

function numeroOuNulo(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === '') return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

/**
 * Consulta limite, valor em aberto e disponível.
 * Com `bloquear`, trava as parcelas em aberto do cliente (FOR UPDATE) para
 * que duas vendas no carnê simultâneas não ultrapassem o limite juntas.
 */
export async function consultarCreditoCarne(
  executor: DataSource | EntityManager,
  idCliente: number,
  regra: RegraLimiteCarne,
  bloquear = false,
): Promise<CreditoCarne | null> {
  const [cliente] = (await executor.query('SELECT limite_carne, faixasalarial FROM cad_clientes WHERE id = ?', [
    idCliente,
  ])) as Array<{ limite_carne: unknown; faixasalarial: unknown }>;
  if (!cliente) return null;

  const [aberto] = (await executor.query(
    `SELECT COALESCE(SUM(vr_parcela), 0) AS total FROM mv_financeiro
      WHERE id_cliente = ? AND origem_lancamento = ? AND estornado = 0 AND efetuado = ?${bloquear ? ' FOR UPDATE' : ''}`,
    [idCliente, ORIGEM_FINANCEIRO.CARNE, NAO],
  )) as Array<{ total: unknown }>;

  const dados = { limiteCarne: numeroOuNulo(cliente.limite_carne), faixaSalarial: numeroOuNulo(cliente.faixasalarial) };
  const { limite, origem } = calcularLimiteCarne(dados, regra);
  const emAberto = paraCentavos(numeroOuNulo(aberto?.total) ?? 0);
  return {
    idCliente,
    limite: paraReais(limite),
    origem,
    emAberto: paraReais(emAberto),
    disponivel: paraReais(Math.max(0, limite - emAberto)),
    faixaSalarial: dados.faixaSalarial,
    percentualRenda: regra.percentualRenda,
  };
}

/** Recusa (409) a venda se o valor no carnê passar do disponível. */
export function garantirLimiteCarne(credito: CreditoCarne, valorCarne: Centavos, nomeCliente: string | null): void {
  const disponivel = paraCentavos(credito.disponivel);
  if (valorCarne <= disponivel) return;
  const quem = nomeCliente ? ` de ${nomeCliente}` : '';
  throw new ConflictException(
    `Limite do carnê${quem} insuficiente: limite ${formatarReais(paraCentavos(credito.limite))}, ` +
      `em aberto ${formatarReais(paraCentavos(credito.emAberto))}, disponível ${formatarReais(disponivel)}; ` +
      `esta venda precisa de ${formatarReais(valorCarne)} no carnê. ` +
      'O limite é liberado conforme as parcelas são pagas.',
  );
}
