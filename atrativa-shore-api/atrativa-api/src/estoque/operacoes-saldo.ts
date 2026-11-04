import { ConflictException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { MODO_ESTOQUE } from '../common/constantes/legado.js';
import { arredondarQuantidade } from '../common/utils/dinheiro.js';

const TOLERANCIA = 0.0005;

interface ResultadoEscrita {
  affectedRows?: number;
}

function linhasAfetadas(resultado: unknown): number {
  return Number((resultado as ResultadoEscrita | undefined)?.affectedRows ?? 0);
}

export async function bloquearSaldos(
  manager: EntityManager,
  idsProdutos: number[],
): Promise<Map<number, number>> {
  const ids = [...new Set(idsProdutos)];
  if (ids.length === 0) return new Map();
  const linhas = (await manager.query(
    'SELECT id_produto, quantidade FROM mv_estoque WHERE id_produto IN (?) FOR UPDATE',
    [ids],
  )) as Array<{ id_produto: number; quantidade: number | string | null }>;
  return new Map(
    linhas.map((linha) => [Number(linha.id_produto), arredondarQuantidade(Number(linha.quantidade ?? 0))]),
  );
}

export async function baixarSaldo(
  manager: EntityManager,
  idProduto: number,
  quantidade: number,
  descricaoProduto: string,
): Promise<void> {
  const resultado = await manager.query(
    `UPDATE mv_estoque SET quantidade = ROUND(quantidade - ?, 3)
      WHERE id_produto = ? AND quantidade + ? >= ?`,
    [quantidade, idProduto, TOLERANCIA, quantidade],
  );
  if (linhasAfetadas(resultado) !== 1) {
    throw new ConflictException(`Estoque insuficiente para ${descricaoProduto}`);
  }
}

export async function creditarSaldo(
  manager: EntityManager,
  idProduto: number,
  quantidade: number,
): Promise<void> {
  const resultado = await manager.query(
    'UPDATE mv_estoque SET quantidade = ROUND(COALESCE(quantidade, 0) + ?, 3) WHERE id_produto = ?',
    [quantidade, idProduto],
  );
  if (linhasAfetadas(resultado) === 0) {
    await manager.query('INSERT INTO mv_estoque (id_produto, quantidade, modo_estoque) VALUES (?, ?, ?)', [
      idProduto,
      arredondarQuantidade(quantidade),
      MODO_ESTOQUE.CONTROLA,
    ]);
  }
}

export function agruparQuantidades(itens: Array<{ idProduto: number; quantidade: number }>): Map<number, number> {
  const mapa = new Map<number, number>();
  for (const item of itens) {
    mapa.set(item.idProduto, arredondarQuantidade((mapa.get(item.idProduto) ?? 0) + item.quantidade));
  }
  return mapa;
}
