import { hojeIso, inicioDoMesIso } from './formatar';

export interface Periodo {
  inicio: string;
  fim: string;
}

export function periodoDoMes(): Periodo {
  return { inicio: inicioDoMesIso(), fim: hojeIso() };
}
