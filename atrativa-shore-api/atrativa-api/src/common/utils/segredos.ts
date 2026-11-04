import { createHash, randomBytes, randomInt } from 'node:crypto';

export function sha256(valor: string): string {
  return createHash('sha256').update(valor, 'utf8').digest('hex');
}

export function tokenAleatorio(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

const ALFABETO_SENHA = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

export function senhaTemporaria(tamanho = 12): string {
  return Array.from({ length: tamanho }, () => ALFABETO_SENHA[randomInt(ALFABETO_SENHA.length)]).join('');
}

const CHAVES_SENSIVEIS = /senha|password|token|codigo|hash|secret|segredo|cookie|authorization/i;

export function semSegredos(valor: unknown, profundidade = 0): unknown {
  if (profundidade > 4 || valor === null || typeof valor !== 'object') return valor;
  if (Array.isArray(valor)) return valor.slice(0, 50).map((item) => semSegredos(item, profundidade + 1));
  const resultado: Record<string, unknown> = {};
  for (const [chave, item] of Object.entries(valor)) {
    resultado[chave] = CHAVES_SENSIVEIS.test(chave) ? '[removido]' : semSegredos(item, profundidade + 1);
  }
  return resultado;
}
