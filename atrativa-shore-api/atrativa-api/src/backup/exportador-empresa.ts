import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import type { DataSource } from 'typeorm';
import {
  RODAPE_SQL,
  cabecalhoSql,
  comSnapshot,
  criacaoDaTabela,
  dumpTabelas,
  executarMysqldump,
  identificador,
  insercoes,
  mysqldumpDisponivel,
  tabelasDoBanco,
  type ConexaoMysql,
} from './sql.js';
import type { EscritorZip } from './zip.js';

export const VERSAO_FORMATO = 2;
export const FORMATO = 'atrativa-shore-backup-empresa';

export const TABELAS_SEM_DADOS: Record<string, string> = {
  api_credencial: 'hash de senha de acesso',
};

export const COLUNAS_ANONIMIZADAS: Record<string, string[]> = {
  cad_login: ['senha'],
  cad_empresa: ['chave_liberacao'],
};

const COLUNAS_ANONIMIZADAS_PLATAFORMA: Record<string, string[]> = {
  plataforma_usuarios: ['senha_hash'],
};

export interface Progresso {
  (percentual: number, etapa: string): void | Promise<void>;
}

export interface ResumoArquivo {
  arquivo: string;
  origem: 'empresa' | 'plataforma';
  tabelas: Array<{ tabela: string; registros: number }>;
  registros: number;
}

export interface ResultadoExportacao {
  arquivos: ResumoArquivo[];
  registros: number;
  ferramenta: string;
  aviso: string | null;
}

export interface DadosGeracao {
  idEmpresa: number;
  nomeEmpresa: string;
  banco: string;
  geradoPor: { id: number; nome: string };
  geradoEm: Date;
  versaoApi: string;
}

export interface OpcoesExportacao {
  mysqldump: { executavel: string; conexao: ConexaoMysql } | null;
  pastaTemporaria: string;
}

type Linha = Record<string, unknown>;

async function* juntar(...partes: Array<string | AsyncIterable<string | Buffer>>): AsyncGenerator<string | Buffer> {
  for (const parte of partes) {
    if (typeof parte === 'string') yield parte;
    else for await (const pedaco of parte) yield pedaco;
  }
}

export async function exportarEmpresa(
  fonteEmpresa: DataSource,
  plataforma: DataSource,
  zip: EscritorZip,
  dados: DadosGeracao,
  progresso: Progresso,
  opcoes: OpcoesExportacao,
): Promise<ResultadoExportacao> {
  const tabelas = await tabelasDoBanco(fonteEmpresa);
  const contagens = new Map<string, number>();
  for (const tabela of tabelas) {
    if (tabela in TABELAS_SEM_DADOS) {
      contagens.set(tabela, 0);
      continue;
    }
    const [{ total }] = (await fonteEmpresa.query(`SELECT COUNT(*) AS total FROM ${identificador(tabela)}`)) as Array<{
      total: number | string;
    }>;
    contagens.set(tabela, Number(total));
  }

  const id = [dados.idEmpresa];
  const [empresas, planos, cargos, usuarios, ativacoes, auditoria] = (await Promise.all([
    plataforma.query('SELECT * FROM plataforma_empresas WHERE id = ?', id),
    plataforma.query('SELECT p.* FROM plataforma_planos p JOIN plataforma_empresas e ON e.id_plano = p.id WHERE e.id = ?', id),
    plataforma.query('SELECT * FROM plataforma_cargos WHERE id_empresa = ? ORDER BY id', id),
    plataforma.query('SELECT * FROM plataforma_usuarios WHERE id_empresa = ? ORDER BY id', id),
    plataforma.query('SELECT * FROM plataforma_ativacoes WHERE id_empresa = ? ORDER BY id', id),
    plataforma.query('SELECT * FROM plataforma_auditoria WHERE id_empresa = ? ORDER BY id', id),
  ])) as Linha[][];
  const central: Array<[string, Linha[]]> = [
    ['plataforma_empresas', empresas],
    ['plataforma_planos', planos],
    ['plataforma_cargos', cargos],
    ['plataforma_usuarios', usuarios],
    ['plataforma_ativacoes', ativacoes],
    ['plataforma_auditoria', auditoria],
  ];

  const totalEmpresa = [...contagens.values()].reduce((a, b) => a + b, 0);
  const total = Math.max(1, totalEmpresa + central.reduce((a, [, linhas]) => a + linhas.length, 0));
  let feitos = 0;
  const avisar = (etapa: string) => progresso(Math.min(95, Math.round((feitos / total) * 95)), etapa);

  const cadastro = tabelas.includes('cad_empresa')
    ? ((await fonteEmpresa.query('SELECT * FROM cad_empresa ORDER BY id LIMIT 1')) as Linha[])[0]
    : undefined;
  const cadastroLimpo: Linha = {};
  for (const [chave, valor] of Object.entries(cadastro ?? {})) {
    if (!COLUNAS_ANONIMIZADAS.cad_empresa.includes(chave)) cadastroLimpo[chave] = Buffer.isBuffer(valor) ? null : valor;
  }
  await zip.adicionar(
    'empresa.json',
    `${JSON.stringify({ empresa: empresas[0] ?? null, plano: planos[0] ?? null, cadastro: cadastroLimpo }, null, 2)}\n`,
  );

  const sensiveis = tabelas.filter((t) => t in TABELAS_SEM_DADOS || t in COLUNAS_ANONIMIZADAS);
  const opcoesDump = { semDados: Object.keys(TABELAS_SEM_DADOS), mascarar: COLUNAS_ANONIMIZADAS };
  const arquivoEmpresa = 'dados/empresa.sql';
  let ferramenta = 'exportador interno (formato mysqldump)';
  let aviso: string | null = null;
  let feito = false;

  const versao = opcoes.mysqldump ? await mysqldumpDisponivel(opcoes.mysqldump.executavel) : null;
  if (opcoes.mysqldump && versao) {
    const temporario = path.join(opcoes.pastaTemporaria, `${randomUUID()}.sql.parcial`);
    try {
      await progresso(3, 'Executando mysqldump');
      const [{ estimado }] = (await fonteEmpresa.query(
        "SELECT COALESCE(SUM(DATA_LENGTH), 0) AS estimado FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'",
      )) as Array<{ estimado: number | string }>;
      const esperado = Math.max(1, (Number(estimado) || 0) * 1.3);
      await executarMysqldump(
        opcoes.mysqldump.executavel,
        opcoes.mysqldump.conexao,
        [...sensiveis.map((t) => `--ignore-table=${dados.banco}.${t}`), dados.banco],
        temporario,
        (bytes) => {
          feitos = Math.min(totalEmpresa, Math.round((bytes / esperado) * totalEmpresa));
          void avisar('Executando mysqldump');
        },
      );
      await comSnapshot(fonteEmpresa, (executor) =>
        zip.adicionar(
          arquivoEmpresa,
          juntar(
            createReadStream(temporario),
            sensiveis.length ? `\n${cabecalhoSql('tabelas com credenciais (senhas exportadas como NULL)', null)}` : '',
            dumpTabelas(executor, sensiveis, opcoesDump, () => undefined),
            sensiveis.length ? RODAPE_SQL : '',
          ),
        ),
      );
      feitos = totalEmpresa;
      ferramenta = `mysqldump (${versao})`;
      feito = true;
    } catch (erro) {
      aviso = `mysqldump falhou e foi usado o exportador interno: ${(erro as Error).message.slice(0, 200)}`;
      feitos = 0;
      if (zip.entradaIniciada(arquivoEmpresa)) throw erro;
    } finally {
      await rm(temporario, { force: true }).catch(() => undefined);
    }
  }

  if (!feito) {
    await comSnapshot(fonteEmpresa, (executor) =>
      zip.adicionar(
        arquivoEmpresa,
        juntar(
          cabecalhoSql(`banco da empresa ${dados.nomeEmpresa}`, null),
          dumpTabelas(executor, tabelas, opcoesDump, (tabela, linhas) => {
            feitos += linhas;
            if (linhas === 0) void avisar(`Exportando ${tabela}`);
          }),
          RODAPE_SQL,
        ),
      ),
    );
  }

  await avisar('Exportando dados da plataforma');
  const partesCentral: string[] = [cabecalhoSql(`dados da empresa ${dados.nomeEmpresa} no banco central`, null)];
  for (const [tabela, linhas] of central) {
    partesCentral.push(`--\n-- Tabela ${identificador(tabela)} (somente registros desta empresa)\n--\n\n`);
    partesCentral.push(`${await criacaoDaTabela(plataforma, tabela, true)};\n\n`);
    const mascarar = COLUNAS_ANONIMIZADAS_PLATAFORMA[tabela] ?? [];
    if (mascarar.length) partesCentral.push(`-- ${tabela}: colunas ${mascarar.join(', ')} exportadas como NULL (credenciais)\n`);
    partesCentral.push(insercoes(tabela, linhas, mascarar), '\n');
    feitos += linhas.length;
  }
  partesCentral.push(RODAPE_SQL);
  await zip.adicionar('dados/plataforma.sql', partesCentral.join(''));

  const arquivos: ResumoArquivo[] = [
    {
      arquivo: arquivoEmpresa,
      origem: 'empresa',
      tabelas: tabelas.map((tabela) => ({ tabela, registros: contagens.get(tabela) ?? 0 })),
      registros: totalEmpresa,
    },
    {
      arquivo: 'dados/plataforma.sql',
      origem: 'plataforma',
      tabelas: central.map(([tabela, linhas]) => ({ tabela, registros: linhas.length })),
      registros: central.reduce((a, [, linhas]) => a + linhas.length, 0),
    },
  ];
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
        ferramenta,
        aviso,
        codificacao: 'SQL UTF-8 (utf8mb4), binários em hexadecimal',
        consistencia: 'Banco da empresa exportado numa única transação (--single-transaction / snapshot consistente).',
        registros,
        arquivos,
        colunasAnonimizadas: { ...COLUNAS_ANONIMIZADAS, ...COLUNAS_ANONIMIZADAS_PLATAFORMA },
        naoIncluido: [
          ...Object.entries(TABELAS_SEM_DADOS).map(([tabela, motivo]) => ({ tabela, motivo: `${motivo} (só a estrutura)` })),
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
      'dados/empresa.sql     dump MySQL de todas as tabelas do banco da empresa (estrutura e dados, ids originais)',
      'dados/plataforma.sql  registros desta empresa no banco central: empresa, plano, cargos, usuários, ativações e auditoria',
      'empresa.json          dados cadastrais e configurações comerciais, para consulta rápida',
      'metadados.json        versão do formato, data, responsável, ferramenta e quantidade de registros por tabela',
      '',
      'Restaurar o banco da empresa num banco novo e vazio:',
      '  mysql -u <usuario> -p -e "CREATE DATABASE <novo_banco> CHARACTER SET utf8mb4"',
      '  mysql -u <usuario> -p <novo_banco> < dados/empresa.sql',
      '',
      'Não contém senhas, hashes de senha, tokens nem códigos de ativação: essas colunas saem como NULL.',
      'Depois de restaurar, os usuários precisam receber uma senha temporária nova.',
      '',
    ].join('\n'),
  );
  return { arquivos, registros, ferramenta, aviso };
}
