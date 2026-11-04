/**
 * Cliente HTTP único da aplicação.
 *
 * - URL base em VITE_API_URL;
 * - envia o JWT em "Authorization: Bearer";
 * - desembrulha o envelope { data } das respostas (listas mantêm { data, meta });
 * - converte erros no formato { statusCode, message } em ApiError;
 * - em 401 fora do login, avisa a aplicação para encerrar a sessão;
 * - GETs idênticos em andamento são compartilhados (evita requisição duplicada).
 */

const URL_BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1').replace(/\/+$/, '');

export class ApiError extends Error {
  readonly status: number;
  readonly mensagens: string[];

  constructor(status: number, mensagens: string[]) {
    super(mensagens.join('\n'));
    this.name = 'ApiError';
    this.status = status;
    this.mensagens = mensagens;
  }
}

type Parametros = Record<string, string | number | boolean | null | undefined>;

interface OpcoesRequisicao {
  metodo?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  corpo?: unknown;
  parametros?: Parametros;
  sinal?: AbortSignal;
  /** Login usa 401 para "senha errada": não deve derrubar a sessão. */
  ignorarSessaoExpirada?: boolean;
}

let tokenAtual: string | null = null;
let aoExpirarSessao: (() => void) | null = null;
const emAndamento = new Map<string, Promise<unknown>>();

export function definirToken(token: string | null): void {
  tokenAtual = token;
}

export function quandoSessaoExpirar(callback: () => void): void {
  aoExpirarSessao = callback;
}

function montarUrl(caminho: string, parametros?: Parametros): string {
  const url = new URL(`${URL_BASE}${caminho.startsWith('/') ? caminho : `/${caminho}`}`);
  for (const [chave, valor] of Object.entries(parametros ?? {})) {
    if (valor !== undefined && valor !== null && valor !== '') url.searchParams.set(chave, String(valor));
  }
  return url.toString();
}

function mensagensDoCorpo(corpo: unknown, status: number): string[] {
  const mensagem = (corpo as { message?: unknown } | null)?.message;
  if (Array.isArray(mensagem)) return mensagem.map(String);
  if (typeof mensagem === 'string' && mensagem) return [mensagem];
  if (status === 0) return ['Não foi possível conectar à API. Verifique se o servidor está no ar.'];
  return [`Erro ${status} ao comunicar com a API.`];
}

async function executar<T>(caminho: string, opcoes: OpcoesRequisicao): Promise<T> {
  const metodo = opcoes.metodo ?? 'GET';
  const cabecalhos: Record<string, string> = { Accept: 'application/json' };
  if (opcoes.corpo !== undefined) cabecalhos['Content-Type'] = 'application/json';
  if (tokenAtual) cabecalhos.Authorization = `Bearer ${tokenAtual}`;

  let resposta: Response;
  try {
    resposta = await fetch(montarUrl(caminho, opcoes.parametros), {
      method: metodo,
      headers: cabecalhos,
      body: opcoes.corpo === undefined ? undefined : JSON.stringify(opcoes.corpo),
      signal: opcoes.sinal,
    });
  } catch (erro) {
    if ((erro as Error).name === 'AbortError') throw erro;
    throw new ApiError(0, mensagensDoCorpo(null, 0));
  }

  if (resposta.status === 204) return undefined as T;

  let corpo: unknown = null;
  const texto = await resposta.text();
  if (texto) {
    try {
      corpo = JSON.parse(texto);
    } catch {
      corpo = null;
    }
  }

  if (!resposta.ok) {
    if (resposta.status === 401 && tokenAtual && !opcoes.ignorarSessaoExpirada) aoExpirarSessao?.();
    throw new ApiError(resposta.status, mensagensDoCorpo(corpo, resposta.status));
  }

  // Listas paginadas ficam com { data, meta, ... }; o resto é desembrulhado.
  if (corpo && typeof corpo === 'object' && 'data' in corpo && !('meta' in corpo)) {
    return (corpo as { data: T }).data;
  }
  return corpo as T;
}

export function requisitar<T>(caminho: string, opcoes: OpcoesRequisicao = {}): Promise<T> {
  const metodo = opcoes.metodo ?? 'GET';
  if (metodo !== 'GET' || opcoes.sinal) return executar<T>(caminho, opcoes);

  const chave = montarUrl(caminho, opcoes.parametros);
  const existente = emAndamento.get(chave);
  if (existente) return existente as Promise<T>;
  const promessa = executar<T>(caminho, opcoes).finally(() => emAndamento.delete(chave));
  emAndamento.set(chave, promessa);
  return promessa;
}

export const api = {
  get: <T>(caminho: string, parametros?: Parametros, sinal?: AbortSignal) =>
    requisitar<T>(caminho, { parametros, sinal }),
  post: <T>(caminho: string, corpo?: unknown, extra?: Partial<OpcoesRequisicao>) =>
    requisitar<T>(caminho, { metodo: 'POST', corpo: corpo ?? {}, ...extra }),
  patch: <T>(caminho: string, corpo: unknown) => requisitar<T>(caminho, { metodo: 'PATCH', corpo }),
  delete: (caminho: string) => requisitar<void>(caminho, { metodo: 'DELETE' }),
};

export function mensagemErro(erro: unknown): string {
  if (erro instanceof ApiError) return erro.mensagens.join(' • ');
  if (erro instanceof Error) return erro.message;
  return 'Erro inesperado.';
}

export type { Parametros };
