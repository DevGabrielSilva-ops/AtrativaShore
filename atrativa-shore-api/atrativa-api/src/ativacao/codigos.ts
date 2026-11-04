import { randomInt } from 'node:crypto';
import { sha256 } from '../common/utils/segredos.js';
import type { CodigoAtivacao } from '../plataforma/entities/index.js';

const ALFABETO = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const GRUPOS = 5;
const TAMANHO_GRUPO = 5;

export type SituacaoCodigo = 'ATIVO' | 'USADO' | 'EXPIRADO' | 'REVOGADO';

export function gerarCodigoAtivacao(): { codigo: string; normalizado: string } {
  const normalizado = Array.from({ length: GRUPOS * TAMANHO_GRUPO }, () => ALFABETO[randomInt(ALFABETO.length)]).join('');
  const grupos = normalizado.match(new RegExp(`.{${TAMANHO_GRUPO}}`, 'g'))!;
  return { codigo: `ATV-${grupos.join('-')}`, normalizado };
}

export function normalizarCodigo(entrada: string): string {
  return entrada
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/^ATV/, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
}

export function hashDoCodigo(entrada: string): string {
  return sha256(normalizarCodigo(entrada));
}

export function prefixoDoCodigo(normalizado: string): string {
  return `ATV-${normalizado.slice(0, TAMANHO_GRUPO)}`;
}

export function situacaoDoCodigo(codigo: Pick<CodigoAtivacao, 'revogadoEm' | 'expiraEm' | 'usos' | 'maxUsos'>, agora = new Date()): SituacaoCodigo {
  if (codigo.revogadoEm) return 'REVOGADO';
  if (codigo.usos >= codigo.maxUsos) return 'USADO';
  if (codigo.expiraEm.getTime() <= agora.getTime()) return 'EXPIRADO';
  return 'ATIVO';
}

export function sha256Normalizado(normalizado: string): string {
  return sha256(normalizado);
}
