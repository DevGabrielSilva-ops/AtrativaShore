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
  sessao: {
    refreshDias: number;
    refreshHorasSemLembrar: number;
    cookieSeguro: boolean;
    cookieSameSite: 'strict' | 'lax' | 'none';
  };
  plataforma: {
    banco: string;
    prefixoBancoEmpresa: string;
    conexoesPorEmpresa: number;
    ativacaoValidadeDias: number;
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
  carneLimite: {
    percentualRenda: number;
    limitePadrao: number;
  };
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

function decimal(env: Ambiente, chave: string, padrao: number, minimo: number, maximo: number): number {
  const bruto = env[chave]?.trim();
  if (bruto === undefined || bruto === '') return padrao;
  const valor = Number(bruto.replace(',', '.'));
  if (!Number.isFinite(valor) || valor < minimo || valor > maximo || Math.round(valor * 100) !== valor * 100) {
    throw new Error(
      `Variável ${chave} inválida: "${bruto}" (esperado valor entre ${minimo} e ${maximo}, até 2 casas decimais)`,
    );
  }
  return valor;
}

function nomeBanco(valor: string, chave: string): string {
  if (!/^[A-Za-z0-9_]{1,48}$/.test(valor)) {
    throw new Error(`Variável ${chave} inválida: use só letras, números e _ (até 48 caracteres)`);
  }
  return valor;
}

function sameSite(valor: string): 'strict' | 'lax' | 'none' {
  const normalizado = valor.toLowerCase();
  if (normalizado === 'strict' || normalizado === 'lax' || normalizado === 'none') return normalizado;
  throw new Error('COOKIE_SAMESITE deve ser strict, lax ou none');
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
      expiraEm: texto(env, 'JWT_EXPIRES_IN', '15m'),
    },
    sessao: {
      refreshDias: inteiro(env, 'REFRESH_TOKEN_DIAS', 7, 1, 90),
      refreshHorasSemLembrar: inteiro(env, 'REFRESH_TOKEN_HORAS_SESSAO', 12, 1, 72),
      cookieSeguro: booleano(env, 'COOKIE_SECURE', ambiente === 'production'),
      cookieSameSite: sameSite(texto(env, 'COOKIE_SAMESITE', 'strict')),
    },
    plataforma: {
      banco: nomeBanco(texto(env, 'DB_PLATAFORMA', 'atrativa_plataforma'), 'DB_PLATAFORMA'),
      prefixoBancoEmpresa: nomeBanco(texto(env, 'DB_EMPRESA_PREFIXO', 'atrativa_emp_'), 'DB_EMPRESA_PREFIXO'),
      conexoesPorEmpresa: inteiro(env, 'DB_CONEXOES_POR_EMPRESA', 5, 1, 50),
      ativacaoValidadeDias: inteiro(env, 'ATIVACAO_VALIDADE_DIAS', 7, 1, 365),
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
    carneLimite: {
      percentualRenda: inteiro(env, 'CARNE_LIMITE_PERCENTUAL_RENDA', 50, 0, 1000),
      limitePadrao: decimal(env, 'CARNE_LIMITE_PADRAO', 300, 0, 10_000_000),
    },
  };
}

export function validarAmbiente(env: Record<string, unknown>): Record<string, unknown> {
  carregarConfiguracao(env as Ambiente);
  return env;
}
