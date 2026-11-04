import type { DataSource, EntityManager } from 'typeorm';
import { STATUS_CAIXA } from '../common/constantes/legado.js';

export interface LinhaCaixa {
  id: number;
  data_abertura: string | null;
  hora_abertura: string | null;
  data_fechamento: string | null;
  hora_fechamento: string | null;
  vr_abertura: number | string | null;
  vr_fechamento: number | string | null;
  id_login: number | null;
  turno: string | null;
  terminal: string | null;
  status_caixa: string | null;
}

/** Caixa aberto do terminal (status 'P'), se houver. */
export async function buscarCaixaAberto(
  executor: DataSource | EntityManager,
  terminal: string,
): Promise<LinhaCaixa | null> {
  const [linha] = (await executor.query(
    `SELECT id, data_abertura, hora_abertura, data_fechamento, hora_fechamento, vr_abertura, vr_fechamento,
            id_login, turno, terminal, status_caixa
       FROM mv_fechamento WHERE terminal = ? AND status_caixa = ? ORDER BY id DESC LIMIT 1`,
    [terminal, STATUS_CAIXA.ABERTO],
  )) as LinhaCaixa[];
  return linha ?? null;
}
