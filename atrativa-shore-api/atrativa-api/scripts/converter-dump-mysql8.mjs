#!/usr/bin/env node
/**
 * Converte o dump do MySQL 4.0 (bd.sql) para importar no MySQL 8.
 *
 *   node scripts/converter-dump-mysql8.mjs <entrada.sql> <saida.sql>
 *
 * O que muda:
 *  - "TYPE=MyISAM" (removido no MySQL 5.5+) vira "ENGINE=MyISAM DEFAULT CHARSET=latin1";
 *  - cabeçalho com SET NAMES latin1 e sql_mode vazio, para aceitar os
 *    defaults legados ('0000-00-00', FLOAT(M,D), ZEROFILL).
 *
 * O que NÃO muda: nomes, colunas, tipos e dados. Os bytes são preservados
 * (leitura e escrita em latin1), inclusive os acentos em CP850 que o desktop gravou.
 *
 * ATENÇÃO: o dump começa cada tabela com DROP TABLE IF EXISTS. Importe
 * apenas em um banco vazio ou de teste, nunca por cima do banco em uso.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const [entrada, saida] = process.argv.slice(2);
if (!entrada || !saida) {
  console.error('Uso: node scripts/converter-dump-mysql8.mjs <entrada.sql> <saida.sql>');
  process.exit(1);
}
if (entrada === saida) {
  console.error('A saída deve ser um arquivo diferente da entrada.');
  process.exit(1);
}

const original = readFileSync(entrada, 'latin1');
const tabelas = (original.match(/CREATE TABLE /g) ?? []).length;
let substituicoes = 0;
const convertido = original
  .replace(/\)\s*TYPE\s*=\s*MyISAM\s*;/g, () => {
    substituicoes += 1;
    return ') ENGINE=MyISAM DEFAULT CHARSET=latin1;';
  })
  // Linhas só com hífens ("-----"): o MySQL 8 exige "-- " (com espaço) para comentário.
  .replace(/^(-{3,})[ \t]*(\r?)$/gm, '-- $1$2');

if (substituicoes !== tabelas) {
  console.error(
    `Esperava ${tabelas} definições "TYPE=MyISAM", encontrei ${substituicoes}. Nada foi gravado.`,
  );
  process.exit(1);
}

const cabecalho = [
  '-- Convertido para MySQL 8 por scripts/converter-dump-mysql8.mjs',
  'SET NAMES latin1;',
  "SET SESSION sql_mode = '';",
  'SET FOREIGN_KEY_CHECKS = 0;',
  '',
].join('\n');

writeFileSync(saida, cabecalho + convertido + '\nSET FOREIGN_KEY_CHECKS = 1;\n', 'latin1');
console.log(`${tabelas} tabelas convertidas → ${saida}`);
