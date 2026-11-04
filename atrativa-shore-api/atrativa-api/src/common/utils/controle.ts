import { ConflictException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { gerarControle, proximoControle } from './datas.js';

type TabelaComControle = 'mv_vendas' | 'mv_vendas_movimento' | 'mv_estoque_historico' | 'mv_financeiro';

/**
 * Gera um "controle" (yyyymmddhhmmss) ainda não usado nas tabelas indicadas.
 * O desktop usa o mesmo formato; se o segundo atual já foi usado, avança
 * um segundo. O UNIQUE de mv_vendas.controle é a garantia final.
 */
export async function controleDisponivel(
  manager: EntityManager,
  fusoHorario: string,
  tabelas: TabelaComControle[],
  agora: Date = new Date(),
): Promise<string> {
  let controle = gerarControle(agora, fusoHorario);
  for (let tentativa = 0; tentativa < 60; tentativa += 1) {
    const usos = (await manager.query(
      tabelas.map((tabela) => `SELECT 1 FROM ${tabela} WHERE controle = ?`).join(' UNION ALL ') + ' LIMIT 1',
      tabelas.map(() => controle),
    )) as unknown[];
    if (usos.length === 0) return controle;
    controle = proximoControle(controle);
  }
  throw new ConflictException('Não foi possível gerar um controle único; tente novamente');
}
