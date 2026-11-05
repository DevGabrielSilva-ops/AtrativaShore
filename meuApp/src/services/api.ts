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
  ignorarSessaoExpirada?: boolean;
  semRenovar?: boolean;
}

let tokenAtual: string | null = null;
let aoExpirarSessao: (() => void) | null = null;
let renovador: (() => Promise<string | null>) | null = null;
let renovacaoEmAndamento: Promise<string | null> | null = null;
const emAndamento = new Map<string, Promise<unknown>>();

export function definirToken(token: string | null): void {
  tokenAtual = token;
}

export function quandoSessaoExpirar(callback: () => void): void {
  aoExpirarSessao = callback;
}

export function definirRenovador(funcao: () => Promise<string | null>): void {
  renovador = funcao;
}

function renovarUmaVez(): Promise<string | null> {
  if (!renovador) return Promise.resolve(null);
  renovacaoEmAndamento ??= renovador()
    .catch(() => null)
    .finally(() => {
      renovacaoEmAndamento = null;
    });
  return renovacaoEmAndamento;
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
      credentials: 'include',
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
    if (resposta.status === 401 && tokenAtual && !opcoes.ignorarSessaoExpirada) {
      if (!opcoes.semRenovar) {
        const novo = await renovarUmaVez();
        if (novo) return executar<T>(caminho, { ...opcoes, semRenovar: true });
      }
      aoExpirarSessao?.();
    }
    throw new ApiError(resposta.status, mensagensDoCorpo(corpo, resposta.status));
  }

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

export async function baixarArquivo(caminho: string, nomePadrao: string, semRenovar = false): Promise<void> {
  const cabecalhos: Record<string, string> = { Accept: 'application/zip, application/json' };
  if (tokenAtual) cabecalhos.Authorization = `Bearer ${tokenAtual}`;
  let resposta: Response;
  try {
    resposta = await fetch(montarUrl(caminho), { headers: cabecalhos, credentials: 'include', cache: 'no-store' });
  } catch {
    throw new ApiError(0, mensagensDoCorpo(null, 0));
  }
  if (!resposta.ok) {
    if (resposta.status === 401 && tokenAtual && !semRenovar) {
      if (await renovarUmaVez()) return baixarArquivo(caminho, nomePadrao, true);
      aoExpirarSessao?.();
    }
    const corpo: unknown = await resposta.json().catch(() => null);
    throw new ApiError(resposta.status, mensagensDoCorpo(corpo, resposta.status));
  }
  const disposicao = resposta.headers.get('Content-Disposition') ?? '';
  const codificado = /filename\*=UTF-8''([^;]+)/i.exec(disposicao)?.[1];
  const simples = /filename="([^"]+)"/i.exec(disposicao)?.[1];
  const nome = (codificado ? decodeURIComponent(codificado) : simples) || nomePadrao;
  const arquivo = await resposta.blob();
  const url = URL.createObjectURL(arquivo);
  const link = document.createElement('a');
  link.href = url;
  link.download = nome;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function enviarArquivo<T>(
  caminho: string,
  campo: string,
  arquivo: File,
  aoProgresso?: (percentual: number) => void,
  semRenovar = false,
): Promise<T> {
  return new Promise<T>((resolver, rejeitar) => {
    const requisicao = new XMLHttpRequest();
    requisicao.open('POST', montarUrl(caminho));
    requisicao.withCredentials = true;
    requisicao.setRequestHeader('Accept', 'application/json');
    if (tokenAtual) requisicao.setRequestHeader('Authorization', `Bearer ${tokenAtual}`);
    requisicao.upload.onprogress = (evento) => {
      if (evento.lengthComputable) aoProgresso?.(Math.round((evento.loaded / evento.total) * 100));
    };
    requisicao.onerror = () => rejeitar(new ApiError(0, mensagensDoCorpo(null, 0)));
    requisicao.onload = () => {
      let corpo: unknown = null;
      try {
        corpo = requisicao.responseText ? JSON.parse(requisicao.responseText) : null;
      } catch {
        corpo = null;
      }
      if (requisicao.status === 401 && tokenAtual && !semRenovar) {
        void renovarUmaVez().then((novo) => {
          if (novo) enviarArquivo<T>(caminho, campo, arquivo, aoProgresso, true).then(resolver, rejeitar);
          else {
            aoExpirarSessao?.();
            rejeitar(new ApiError(401, mensagensDoCorpo(corpo, 401)));
          }
        });
        return;
      }
      if (requisicao.status < 200 || requisicao.status >= 300) {
        const mensagens =
          requisicao.status === 413 ? ['O arquivo é maior que o limite permitido pelo servidor.'] : mensagensDoCorpo(corpo, requisicao.status);
        rejeitar(new ApiError(requisicao.status, mensagens));
        return;
      }
      resolver((corpo && typeof corpo === 'object' && 'data' in corpo ? (corpo as { data: T }).data : corpo) as T);
    };
    const formulario = new FormData();
    formulario.append(campo, arquivo, arquivo.name);
    requisicao.send(formulario);
  });
}

export function mensagemErro(erro: unknown): string {
  if (erro instanceof ApiError) return erro.mensagens.join(' • ');
  if (erro instanceof Error) return erro.message;
  return 'Erro inesperado.';
}

export type { Parametros };
