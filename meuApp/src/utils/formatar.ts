const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const moedaCompacta = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
});
const numero = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 });
const inteiro = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const percentual = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1, signDisplay: 'exceptZero' });

export const formatarMoeda = (valor: number | null | undefined) => (valor == null ? '—' : moeda.format(valor));

export const formatarMoedaCompacta = (valor: number) =>
  Math.abs(valor) < 10_000 ? moeda.format(valor) : moedaCompacta.format(valor);

export const formatarNumero = (valor: number | null | undefined) => (valor == null ? '—' : numero.format(valor));

export const formatarInteiro = (valor: number | null | undefined) => (valor == null ? '—' : inteiro.format(valor));

export const formatarVariacao = (valor: number | null | undefined) =>
  valor == null ? null : `${percentual.format(valor)}%`;

export function formatarData(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [ano, mes, dia] = iso.slice(0, 10).split('-');
  return dia && mes && ano ? `${dia}/${mes}/${ano}` : iso;
}

export function formatarMes(iso: string): string {
  const [ano, mes] = iso.split('-').map(Number);
  const nome = new Date(Date.UTC(ano, mes - 1, 15)).toLocaleDateString('pt-BR', { month: 'short', timeZone: 'UTC' });
  return `${nome.replace('.', '')}/${String(ano).slice(2)}`;
}

export function formatarDocumento(valor: string | null | undefined): string {
  const digitos = (valor ?? '').replace(/\D/g, '');
  if (digitos.length === 11) return digitos.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (digitos.length === 14) return digitos.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return valor || '—';
}

export function formatarTelefone(valor: string | null | undefined): string {
  const digitos = (valor ?? '').replace(/\D/g, '');
  if (digitos.length === 11) return digitos.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  if (digitos.length === 10) return digitos.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  return valor || '—';
}

export function hojeIso(): string {
  const agora = new Date();
  const local = new Date(agora.getTime() - agora.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function inicioDoMesIso(): string {
  return `${hojeIso().slice(0, 8)}01`;
}

export function somarDiasIso(iso: string, dias: number): string {
  const [ano, mes, dia] = iso.split('-').map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia + dias)).toISOString().slice(0, 10);
}

export function lerNumero(texto: string): number | null {
  const limpo = texto.trim().replace(/\s/g, '').replace(/R\$/i, '');
  if (!limpo) return null;
  const normalizado = limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo;
  const valor = Number(normalizado);
  return Number.isFinite(valor) ? valor : null;
}

export function numeroParaCampo(valor: number | null | undefined, casas = 2): string {
  if (valor == null) return '';
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas, useGrouping: false });
}

export function somarReais(valores: number[]): number {
  return valores.reduce((total, valor) => total + Math.round(valor * 100), 0) / 100;
}

const dataHora = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

export function formatarDataHora(valor: string | null | undefined): string {
  if (!valor) return '—';
  const data = new Date(/[zZ]|[+-]\d{2}:\d{2}$/.test(valor) ? valor : valor.replace(' ', 'T'));
  return Number.isNaN(data.getTime()) ? valor : dataHora.format(data);
}
