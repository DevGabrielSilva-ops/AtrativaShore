/**
 * Datas no fuso da loja.
 *
 * O banco guarda DATE (sem hora) e TIME separados, além do "controle"
 * (yyyymmddhhmmss) que identifica vendas e lançamentos. Tudo é calculado
 * no fuso configurado (APP_TIMEZONE), independente do fuso do servidor.
 */

export interface PartesDataHora {
  ano: string;
  mes: string;
  dia: string;
  hora: string;
  minuto: string;
  segundo: string;
}

export const REGEX_DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

export function partesNoFuso(data: Date, fusoHorario: string): PartesDataHora {
  const formatador = new Intl.DateTimeFormat('en-CA', {
    timeZone: fusoHorario,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const partes = Object.fromEntries(
    formatador.formatToParts(data).map((parte) => [parte.type, parte.value]),
  );
  return {
    ano: partes.year,
    mes: partes.month,
    dia: partes.day,
    hora: partes.hour,
    minuto: partes.minute,
    segundo: partes.second,
  };
}

export function dataNoFuso(data: Date, fusoHorario: string): string {
  const p = partesNoFuso(data, fusoHorario);
  return `${p.ano}-${p.mes}-${p.dia}`;
}

export function horaNoFuso(data: Date, fusoHorario: string): string {
  const p = partesNoFuso(data, fusoHorario);
  return `${p.hora}:${p.minuto}:${p.segundo}`;
}

/** Controle no formato do legado: yyyymmddhhmmss (14 caracteres). */
export function gerarControle(data: Date, fusoHorario: string): string {
  const p = partesNoFuso(data, fusoHorario);
  return `${p.ano}${p.mes}${p.dia}${p.hora}${p.minuto}${p.segundo}`;
}

/** Próximo controle (1 segundo depois), tratando virada de minuto/dia/mês. */
export function proximoControle(controle: string): string {
  if (!/^\d{14}$/.test(controle)) throw new RangeError(`Controle inválido: ${controle}`);
  const instante = Date.UTC(
    Number(controle.slice(0, 4)),
    Number(controle.slice(4, 6)) - 1,
    Number(controle.slice(6, 8)),
    Number(controle.slice(8, 10)),
    Number(controle.slice(10, 12)),
    Number(controle.slice(12, 14)) + 1,
  );
  return new Date(instante).toISOString().replace(/\D/g, '').slice(0, 14);
}

export function dataIsoValida(valor: string): boolean {
  if (!REGEX_DATA_ISO.test(valor)) return false;
  const [ano, mes, dia] = valor.split('-').map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  return (
    data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia
  );
}

export function adicionarDias(dataIso: string, dias: number): string {
  const [ano, mes, dia] = dataIso.split('-').map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia + dias)).toISOString().slice(0, 10);
}

/** Soma meses mantendo o dia; se o mês não tiver o dia, usa o último dia do mês. */
export function adicionarMeses(dataIso: string, meses: number): string {
  const [ano, mes, dia] = dataIso.split('-').map(Number);
  const ultimoDia = new Date(Date.UTC(ano, mes - 1 + meses + 1, 0)).getUTCDate();
  return new Date(Date.UTC(ano, mes - 1 + meses, Math.min(dia, ultimoDia)))
    .toISOString()
    .slice(0, 10);
}

export function diferencaEmDias(inicioIso: string, fimIso: string): number {
  const inicio = Date.parse(`${inicioIso}T00:00:00Z`);
  const fim = Date.parse(`${fimIso}T00:00:00Z`);
  return Math.round((fim - inicio) / 86_400_000);
}

/**
 * Vencimentos de carnê no padrão do legado: a 1ª parcela vence 30 dias após
 * a venda e as demais no mesmo dia dos meses seguintes
 * (venda 20/08 → 19/09, 19/10, 19/11, 19/12).
 */
export function vencimentosCarne(dataVenda: string, parcelas: number, primeiro?: string): string[] {
  const primeiroVencimento = primeiro ?? adicionarDias(dataVenda, 30);
  return Array.from({ length: parcelas }, (_, i) => adicionarMeses(primeiroVencimento, i));
}

/** O MySQL legado usa '0000-00-00' como "sem data". */
export function normalizarDataLegada(valor: string | null | undefined): string | null {
  if (!valor || valor.startsWith('0000-00-00')) return null;
  return valor.slice(0, 10);
}

/** Hora (HH:MM:SS) extraída do controle yyyymmddhhmmss. */
export function horaDoControle(controle: string | null): string | null {
  if (!controle || !/^\d{14}$/.test(controle)) return null;
  return `${controle.slice(8, 10)}:${controle.slice(10, 12)}:${controle.slice(12, 14)}`;
}
