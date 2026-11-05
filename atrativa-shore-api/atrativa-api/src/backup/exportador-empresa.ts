import type { DataSource, QueryRunner } from 'typeorm';
import type { EscritorZip } from './zip.js';

export const VERSAO_FORMATO = 1;
export const FORMATO = 'atrativa-shore-backup-empresa';

export const TABELAS_EXCLUIDAS: Record<string, string> = {
  api_credencial: 'hash de senha de acesso',
};

export const COLUNAS_OMITIDAS: Record<string, string[]> = {
  cad_login: ['senha'],
  cad_empresa: ['chave_liberacao'],
};

const COLUNAS_USUARIOS = [
  'id',
  'id_empresa',
  'nome',
  'email',
  'login',
  'papel',
  'id_cargo',
  'status',
  'trocar_senha',
  'id_login_legado',
  'ultimo_login_em',
  'criado_em',
  'atualizado_em',
  'criado_por',
];

const TAMANHO_LOTE = 2000;

export interface Progresso {
  (percentual: number, etapa: string): void | Promise<void>;
}

export interface ResumoArquivo {
  arquivo: string;
  tabela: string;
  origem: 'empresa' | 'plataforma';
  registros: number;
  colunasOmitidas: string[];
}

export interface ResultadoExportacao {
  arquivos: ResumoArquivo[];
  registros: number;
}

export interface DadosGeracao {
  idEmpresa: number;
  nomeEmpresa: string;
  geradoPor: { id: number; nome: string };
  geradoEm: Date;
  versaoApi: string;
}

type Linha = Record<string, unknown>;

export function serializarValor(valor: unknown): unknown {
  if (Buffer.isBuffer(valor)) return { $base64: valor.toString('base64') };
  if (valor instanceof Date) return valor.toISOString();
  if (typeof valor === 'bigint') return valor.toString();
  return valor;
}

function serializarLinha(linha: Linha): string {
  const saida: Linha = {};
  for (const [chave, valor] of Object.entries(linha)) saida[chave] = serializarValor(valor);
  return JSON.stringify(saida);
}

function identificador(nome: string): string {
  if (!/^[A-Za-z0-9_$]+$/.test(nome)) throw new Error(`Nome inválido no banco: ${nome}`);
  return `\`${nome}\``;
}

async function* arquivoJson(
  cabecalho: Record<string, unknown>,
  linhas: AsyncIterable<Linha>,
  aoContar: (quantidade: number) => void,
): AsyncGenerator<string> {
  const inicio = JSON.stringify(cabecalho);
  yield `${inicio.slice(0, -1)},"linhas":[`;
  let primeira = true;
  let buffer: string[] = [];
  for await (const linha of linhas) {
    buffer.push((primeira ? '\n' : ',\n') + serializarLinha(linha));
    primeira = false;
    aoContar(1);
    if (buffer.length >= 500) {
      yield buffer.join('');
      buffer = [];
    }
  }
  if (buffer.length) yield buffer.join('');
  yield '\n]}\n';
}

async function* lerTabela(executor: QueryRunner, tabela: string, colunas: string[], ordem: string[]): AsyncGenerator<Linha> {
  const lista = colunas.map(identificador).join(', ');
  const ordenacao = ordem.length ? ` ORDER BY ${ordem.map(identificador).join(', ')}` : '';
  for (let deslocamento = 0; ; deslocamento += TAMANHO_LOTE) {
    const linhas = (await executor.query(
      `SELECT ${lista} FROM ${identificador(tabela)}${ordenacao} LIMIT ${TAMANHO_LOTE} OFFSET ${deslocamento}`,
    )) as Linha[];
    for (const linha of linhas) yield linha;
    if (linhas.length < TAMANHO_LOTE || ordem.length === 0) {
      if (ordem.length === 0 && linhas.length === TAMANHO_LOTE) {
        throw new Error(`Tabela ${tabela} sem chave primária e com mais de ${TAMANHO_LOTE} linhas`);
      }
      return;
    }
  }
}

async function* deLista(linhas: Linha[]): AsyncGenerator<Linha> {
  for (const linha of linhas) yield linha;
}

export async function exportarEmpresa(
  fonteEmpresa: DataSource,
  plataforma: DataSource,
  zip: EscritorZip,
  dados: DadosGeracao,
  progresso: Progresso,
): Promise<ResultadoExportacao> {
  const arquivos: ResumoArquivo[] = [];
  const executor = fonteEmpresa.createQueryRunner();
  await executor.connect();
  try {
    await executor.query('SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    await executor.query('START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY');

    const tabelas = (
      (await executor.query(
        "SELECT TABLE_NAME AS nome FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME",
      )) as Array<{ nome: string }>
    )
      .map((t) => t.nome)
      .filter((nome) => !(nome in TABELAS_EXCLUIDAS));

    const contagens = new Map<string, number>();
    for (const tabela of tabelas) {
      const [{ total }] = (await executor.query(`SELECT COUNT(*) AS total FROM ${identificador(tabela)}`)) as Array<{
        total: number | string;
      }>;
      contagens.set(tabela, Number(total));
    }
    const [usuarios, cargos, ativacoes, auditoria, [empresaPlataforma], planos] = await Promise.all([
      plataforma.query(
        `SELECT ${COLUNAS_USUARIOS.map(identificador).join(', ')} FROM plataforma_usuarios WHERE id_empresa = ? ORDER BY id`,
        [dados.idEmpresa],
      ) as Promise<Linha[]>,
      plataforma.query('SELECT * FROM plataforma_cargos WHERE id_empresa = ? ORDER BY id', [dados.idEmpresa]) as Promise<Linha[]>,
      plataforma.query('SELECT * FROM plataforma_ativacoes WHERE id_empresa = ? ORDER BY id', [dados.idEmpresa]) as Promise<Linha[]>,
      plataforma.query('SELECT * FROM plataforma_auditoria WHERE id_empresa = ? ORDER BY id', [dados.idEmpresa]) as Promise<Linha[]>,
      plataforma.query(
        `SELECT id, nome, cnpj, email, telefone, cidade, uf, status, id_plano, assinatura_ate, criada_em, ativada_em
           FROM plataforma_empresas WHERE id = ?`,
        [dados.idEmpresa],
      ) as Promise<Linha[]>,
      plataforma.query('SELECT p.* FROM plataforma_planos p JOIN plataforma_empresas e ON e.id_plano = p.id WHERE e.id = ?', [
        dados.idEmpresa,
      ]) as Promise<Linha[]>,
    ]);
    const extras: Array<[string, Linha[], string[]]> = [
      ['plataforma_usuarios', usuarios, ['senha_hash', 'versao_token']],
      ['plataforma_cargos', cargos, []],
      ['plataforma_ativacoes', ativacoes, []],
      ['plataforma_auditoria', auditoria, []],
    ];

    const total = Math.max(
      1,
      [...contagens.values()].reduce((a, b) => a + b, 0) + extras.reduce((a, [, linhas]) => a + linhas.length, 0),
    );
    let feitos = 0;
    const contar = (quantidade: number) => {
      feitos += quantidade;
    };
    const avisar = (etapa: string) => progresso(Math.min(95, Math.round((feitos / total) * 95)), etapa);

    const [cadastro] = (await executor.query(
      'SELECT * FROM cad_empresa ORDER BY id LIMIT 1',
    )) as Linha[];
    const cadastroLimpo: Linha = {};
    for (const [chave, valor] of Object.entries(cadastro ?? {})) {
      if (!COLUNAS_OMITIDAS.cad_empresa.includes(chave)) cadastroLimpo[chave] = serializarValor(valor);
    }
    await zip.adicionar(
      'empresa.json',
      `${JSON.stringify({ empresa: empresaPlataforma ?? null, plano: planos[0] ?? null, cadastro: cadastroLimpo }, null, 2)}\n`,
    );

    for (const tabela of tabelas) {
      await avisar(`Exportando ${tabela}`);
      const colunasBanco = ((await executor.query(`SHOW COLUMNS FROM ${identificador(tabela)}`)) as Array<{ Field: string }>).map(
        (c) => c.Field,
      );
      const omitidas = (COLUNAS_OMITIDAS[tabela] ?? []).filter((c) => colunasBanco.includes(c));
      const colunas = colunasBanco.filter((c) => !omitidas.includes(c));
      const chave = (
        (await executor.query(`SHOW KEYS FROM ${identificador(tabela)} WHERE Key_name = 'PRIMARY'`)) as Array<{
          Column_name: string;
          Seq_in_index: number;
        }>
      )
        .sort((a, b) => a.Seq_in_index - b.Seq_in_index)
        .map((k) => k.Column_name);
      const arquivo = `dados/empresa/${tabela}.json`;
      let registros = 0;
      await zip.adicionar(
        arquivo,
        arquivoJson(
          { tabela, origem: 'empresa', chavePrimaria: chave, colunas, colunasOmitidas: omitidas },
          lerTabela(executor, tabela, colunas, chave),
          (n) => {
            registros += n;
            contar(n);
          },
        ),
      );
      arquivos.push({ arquivo, tabela, origem: 'empresa', registros, colunasOmitidas: omitidas });
    }

    for (const [tabela, linhas, omitidas] of extras) {
      await avisar(`Exportando ${tabela}`);
      const arquivo = `dados/plataforma/${tabela}.json`;
      let registros = 0;
      await zip.adicionar(
        arquivo,
        arquivoJson(
          { tabela, origem: 'plataforma', chavePrimaria: ['id'], colunas: linhas[0] ? Object.keys(linhas[0]) : [], colunasOmitidas: omitidas },
          deLista(linhas),
          (n) => {
            registros += n;
            contar(n);
          },
        ),
      );
      arquivos.push({ arquivo, tabela, origem: 'plataforma', registros, colunasOmitidas: omitidas });
    }

    const registros = arquivos.reduce((a, b) => a + b.registros, 0);
    await progresso(97, 'Gravando metadados');
    await zip.adicionar(
      'metadados.json',
      `${JSON.stringify(
        {
          formato: FORMATO,
          versaoFormato: VERSAO_FORMATO,
          versaoApi: dados.versaoApi,
          geradoEm: dados.geradoEm.toISOString(),
          geradoPor: dados.geradoPor,
          empresa: { id: dados.idEmpresa, nome: dados.nomeEmpresa },
          codificacao: 'JSON UTF-8; colunas binárias em {"$base64": "..."}; datas como texto do banco',
          consistencia: 'Tabelas da empresa lidas numa única transação (snapshot consistente).',
          registros,
          arquivos,
          naoIncluido: [
            ...Object.entries(TABELAS_EXCLUIDAS).map(([tabela, motivo]) => ({ tabela, motivo })),
            { tabela: 'plataforma_refresh_tokens', motivo: 'sessões de acesso' },
            { tabela: 'plataforma_codigos_ativacao', motivo: 'códigos de ativação' },
          ],
        },
        null,
        2,
      )}\n`,
    );
    await zip.adicionar(
      'LEIA-ME.txt',
      [
        `Backup dos dados da empresa ${dados.nomeEmpresa} gerado pelo Atrativa Shore em ${dados.geradoEm.toISOString()}.`,
        '',
        'metadados.json  versão do formato, data, responsável e lista de arquivos com a quantidade de registros',
        'empresa.json    dados cadastrais e configurações comerciais da empresa',
        'dados/empresa/  uma tabela do banco da empresa por arquivo, com os identificadores originais',
        'dados/plataforma/ usuários, cargos, ativações e auditoria desta empresa',
        '',
        'Não contém senhas, hashes de senha, tokens ou códigos de ativação.',
        '',
      ].join('\n'),
    );
    return { arquivos, registros };
  } finally {
    await executor.query('ROLLBACK').catch(() => undefined);
    await executor.release();
  }
}
