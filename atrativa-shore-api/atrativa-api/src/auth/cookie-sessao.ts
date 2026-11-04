import type { Request, Response } from 'express';
import type { ConfiguracaoService } from '../config/configuracao.service.js';
import type { SessaoComRefresh } from './auth.service.js';

export const COOKIE_REFRESH = 'atrativa_rt';

export function lerCookie(requisicao: Request, nome: string): string | undefined {
  const cabecalho = requisicao.headers.cookie;
  if (!cabecalho) return undefined;
  for (const parte of cabecalho.split(';')) {
    const [chave, ...valor] = parte.trim().split('=');
    if (chave === nome) return decodeURIComponent(valor.join('='));
  }
  return undefined;
}

function opcoes(config: ConfiguracaoService) {
  const { cookieSeguro, cookieSameSite } = config.valores.sessao;
  return {
    httpOnly: true,
    secure: cookieSeguro || cookieSameSite === 'none',
    sameSite: cookieSameSite,
    path: `/${config.valores.prefixoApi}/auth`,
  } as const;
}

export function gravarCookie(resposta: Response, config: ConfiguracaoService, sessao: SessaoComRefresh): void {
  resposta.cookie(COOKIE_REFRESH, sessao.refreshToken, {
    ...opcoes(config),
    ...(sessao.persistente ? { expires: sessao.refreshExpiraEm } : {}),
  });
}

export function apagarCookie(resposta: Response, config: ConfiguracaoService): void {
  resposta.clearCookie(COOKIE_REFRESH, opcoes(config));
}
