import { hojeIso, inicioDoMesIso } from './formatar';

/** Intervalo de datas enviado à API (AAAA-MM-DD). */
export interface Periodo {
  inicio: string;
  fim: string;
}

/** Do primeiro dia do mês até hoje: período padrão das telas. */
export function periodoDoMes(): Periodo {
  return { inicio: inicioDoMesIso(), fim: hojeIso() };
}
