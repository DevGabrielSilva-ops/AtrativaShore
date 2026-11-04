import type { ValueTransformer } from 'typeorm';
import { arredondarCasas } from './dinheiro.js';
import { normalizarDataLegada } from './datas.js';

export function numeroCasas(casas: number): ValueTransformer {
  return {
    to: (valor: number | null | undefined) =>
      valor === null || valor === undefined ? valor : arredondarCasas(Number(valor), casas),
    from: (valor: unknown) =>
      valor === null || valor === undefined ? null : arredondarCasas(Number(valor), casas),
  };
}

export const dinheiroTransformer = numeroCasas(2);
export const quantidadeTransformer = numeroCasas(3);

export const dataLegadaTransformer: ValueTransformer = {
  to: (valor: string | null | undefined) => valor,
  from: (valor: unknown) =>
    typeof valor === 'string' ? normalizarDataLegada(valor) : (valor ?? null),
};

export function numeroOuNulo(valor: unknown, casas = 2): number | null {
  if (valor === null || valor === undefined || valor === '') return null;
  return arredondarCasas(Number(valor), casas);
}

export function numero(valor: unknown, casas = 2): number {
  return numeroOuNulo(valor, casas) ?? 0;
}
