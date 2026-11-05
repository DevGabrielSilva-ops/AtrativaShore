import { paraCentavos, paraReais, type Centavos } from '../common/utils/dinheiro.js';

export interface ConfigCarne {
  jurosDia: number;
  multa: number;
  carenciaDias: number;
}

export interface Encargos {
  diasAtraso: number;
  juros: number;
  multa: number;
  total: number;
}

export const CONFIG_CARNE_PADRAO: ConfigCarne = { jurosDia: 0, multa: 0, carenciaDias: 0 };

export function diasEntre(inicio: string, fim: string): number {
  const [a, b] = [inicio, fim].map((data) => Date.UTC(Number(data.slice(0, 4)), Number(data.slice(5, 7)) - 1, Number(data.slice(8, 10))));
  return Math.round((b - a) / 86_400_000);
}

export function calcularEncargos(valorParcela: number, vencimento: string | null, dataPagamento: string, config: ConfigCarne): Encargos {
  const valor: Centavos = paraCentavos(valorParcela);
  const diasAtraso = vencimento ? Math.max(0, diasEntre(vencimento, dataPagamento)) : 0;
  if (diasAtraso === 0) return { diasAtraso: 0, juros: 0, multa: 0, total: paraReais(valor) };
  const juros = Math.round((valor * config.jurosDia * diasAtraso) / 100);
  const multa = diasAtraso > config.carenciaDias ? Math.round((valor * config.multa) / 100) : 0;
  return { diasAtraso, juros: paraReais(juros), multa: paraReais(multa), total: paraReais(valor + juros + multa) };
}
