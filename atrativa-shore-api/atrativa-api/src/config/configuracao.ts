/**
 * Leitura e validação das variáveis de ambiente.
 *
 * Toda configuração da API vem do ambiente (.env em desenvolvimento).
 * Nenhuma credencial fica no código. A validação roda na inicialização:
 * se faltar algo obrigatório, a API não sobe e informa o que está errado.
 */

export interface Configuracao {
  ambiente: string;
  porta: number;
  prefixoApi: string;
  origensCors: string[];
  swaggerHabilitado: boolean;
  banco: {
    host: string;
    porta: number;
    usuario: string;
    senha: string;
    nome: string;
    charset: string;
    log: boolean;
  };
  jwt: {
    segredo: string;
    expiraEm: string;
  };
  bcryptRodadas: number;
  fusoHorario: string;
  empresaId: number;
  pdv: {
    terminal: string;
    turno: string;
    exigirCaixaAberto: boolean;
  };
  estoqueBaixoLimitePadrao: number;
  carneMaxParcelas: number;
}

type Ambiente = Record<string, string | undefined>;

function texto(env: Ambiente, chave: string, padrao?: string): string {
  const valor = env[chave]?.trim();
  if (valor === undefined || valor === '') {
    if (padrao !== undefined) return padrao;
    throw new Error(`Variável de ambiente obrigatória ausente: ${chave}`);
  }
  return valor;
}

function inteiro(
  env: Ambiente,
  chave: string,
  padrao: number,
  minimo: number,
  maximo: number,
): number {
  const bruto = env[chave]?.trim();
  if (bruto === undefined || bruto === '') return padrao;
  const valor = Number(bruto);
  if (!Number.isInteger(valor) || valor < minimo || valor > maximo) {
    throw new Error(
      `Variável ${chave} inválida: "${bruto}" (esperado inteiro entre ${minimo} e ${maximo})`,
    );
  }
  return valor;
}

function booleano(env: Ambiente, chave: string, padrao: boolean): boolean {
  const bruto = env[chave]?.trim().toLowerCase();
  if (bruto === undefined || bruto === '') return padrao;
  if (['true', '1', 'sim', 'yes'].includes(bruto)) return true;
  if (['false', '0', 'nao', 'não', 'no'].includes(bruto)) return false;
  throw new Error(`Variável ${chave} inválida: "${bruto}" (use true ou false)`);
}

export function carregarConfiguracao(env: Ambiente = process.env): Configuracao {
  const ambiente = texto(env, 'NODE_ENV', 'development');
  const segredo = texto(env, 'JWT_SECRET');
  if (segredo.length < 32) {
    throw new Error('JWT_SECRET deve ter pelo menos 32 caracteres');
  }
  if (ambiente === 'production' && /altere|troque|exemplo|changeme/i.test(segredo)) {
    throw new Error('JWT_SECRET ainda está com o valor de exemplo');
  }

  const terminal = texto(env, 'PDV_TERMINAL', '02');
  if (!/^\d{2}$/.test(terminal)) {
    throw new Error('PDV_TERMINAL deve ter 2 dígitos (ex.: 02)');
  }
  const turno = texto(env, 'PDV_TURNO', '1');
  if (!/^\d$/.test(turno)) {
    throw new Error('PDV_TURNO deve ter 1 dígito (ex.: 1)');
  }

  const fusoHorario = texto(env, 'APP_TIMEZONE', 'America/Sao_Paulo');
  try {
    new Intl.DateTimeFormat('pt-BR', { timeZone: fusoHorario });
  } catch {
    throw new Error(`APP_TIMEZONE inválido: ${fusoHorario}`);
  }

  return {
    ambiente,
    porta: inteiro(env, 'PORT', 3000, 1, 65535),
    prefixoApi: texto(env, 'API_PREFIX', 'api/v1').replace(/^\/+|\/+$/g, ''),
    origensCors: texto(env, 'CORS_ORIGINS', 'http://localhost:5173')
      .split(',')
      .map((origem) => origem.trim())
      .filter(Boolean),
    swaggerHabilitado: booleano(env, 'SWAGGER_ENABLED', true),
    banco: {
      host: texto(env, 'DB_HOST'),
      porta: inteiro(env, 'DB_PORT', 3306, 1, 65535),
      usuario: texto(env, 'DB_USERNAME'),
      senha: env.DB_PASSWORD ?? '',
      nome: texto(env, 'DB_DATABASE'),
      charset: texto(env, 'DB_CHARSET', 'utf8mb4'),
      log: booleano(env, 'DB_LOGGING', false),
    },
    jwt: {
      segredo,
      expiraEm: texto(env, 'JWT_EXPIRES_IN', '1d'),
    },
    bcryptRodadas: inteiro(env, 'BCRYPT_ROUNDS', 10, 8, 15),
    fusoHorario,
    empresaId: inteiro(env, 'EMPRESA_ID', 1, 1, Number.MAX_SAFE_INTEGER),
    pdv: {
      terminal,
      turno,
      exigirCaixaAberto: booleano(env, 'EXIGIR_CAIXA_ABERTO', true),
    },
    estoqueBaixoLimitePadrao: inteiro(env, 'ESTOQUE_BAIXO_LIMITE', 3, 0, 1_000_000),
    carneMaxParcelas: inteiro(env, 'CARNE_MAX_PARCELAS', 12, 1, 48),
  };
}

/** Usado pelo ConfigModule: falha cedo se o ambiente estiver inválido. */
export function validarAmbiente(env: Record<string, unknown>): Record<string, unknown> {
  carregarConfiguracao(env as Ambiente);
  return env;
}
