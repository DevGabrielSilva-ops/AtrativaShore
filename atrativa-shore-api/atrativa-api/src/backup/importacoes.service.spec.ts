import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { BadRequestException, ConflictException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AcessoGuard } from '../acesso/acesso.guard.js';
import { calcularPermissoes } from '../acesso/permissoes.js';
import type { UsuarioAutenticado } from '../auth/usuario-autenticado.js';
import { restauracoes } from './bloqueio.js';
import { ImportacoesService } from './importacoes.service.js';

type Linha = Record<string, unknown>;

const DUMP = `-- MySQL dump 8.19
CREATE TABLE cad_login (
  id int(8) unsigned NOT NULL auto_increment,
  login varchar(15) default NULL,
  senha varchar(6) default NULL,
  id_perfil int(8) unsigned NOT NULL default '1',
  autoriza char(1) default NULL,
  PRIMARY KEY  (id)
) TYPE=MyISAM;
INSERT INTO cad_login VALUES (1,'ATRATIVA','202020',1,'S'),(2,'CAIXA','111111',2,'N');
CREATE TABLE cad_login_perfil (
  id_perfil int(8) unsigned NOT NULL auto_increment,
  nome_perfil varchar(30) default NULL,
  menu_options varchar(250) default NULL,
  PRIMARY KEY  (id_perfil)
) TYPE=MyISAM;
INSERT INTO cad_login_perfil VALUES (1,'ADMINISTRADOR','SSSS'),(2,'VENDEDOR','SNNN');
CREATE TABLE cad_clientes (id int, nome_cliente varchar(60));
INSERT INTO cad_clientes VALUES (1,'MARIA ANTIGA'),(2,'JOSE ANTIGO');
`;

const ESQUEMA: Record<string, string[]> = {
  cad_login: ['id', 'login', 'senha', 'id_perfil', 'autoriza'],
  cad_login_perfil: ['id_perfil', 'nome_perfil', 'menu_options'],
  cad_clientes: ['id', 'nome_cliente', 'limite_carne'],
  api_credencial: ['id_login', 'senha_hash'],
};

function bancoFalso() {
  const tabelas: Record<string, Linha[]> = {
    cad_login: [{ id: 1, login: 'ADMIN', senha: 'xx', id_perfil: 3, autoriza: 'N' }],
    cad_login_perfil: [{ id_perfil: 3, nome_perfil: 'ACESSO WEB', menu_options: 'NNNN' }],
    cad_clientes: [{ id: 1, nome_cliente: 'CLIENTE ATUAL', limite_carne: null }],
    api_credencial: [{ id_login: 1, senha_hash: '$2b$10$atual' }],
  };
  const comandos: string[] = [];
  let falharInsercao = false;
  const query = async (sql: string, p: unknown[] = []): Promise<unknown> => {
    comandos.push(sql);
    if (/^(SET|START|COMMIT|ROLLBACK)/.test(sql)) return [];
    if (sql.includes('information_schema.TABLES')) return Object.keys(ESQUEMA).map((nome) => ({ nome, motor: 'MyISAM' }));
    if (sql.includes('information_schema.COLUMNS')) return Object.entries(ESQUEMA).flatMap(([tabela, cs]) => cs.map((coluna) => ({ tabela, coluna })));
    let m = /^DELETE FROM `(\w+)`$/.exec(sql);
    if (m) {
      tabelas[m[1]] = [];
      return [];
    }
    m = /^INSERT INTO `(\w+)` \((.+)\) VALUES /.exec(sql);
    if (m) {
      if (falharInsercao) throw new Error('Lost connection to MySQL server during query');
      const colunas = m[2].split(', ').map((c) => c.replace(/`/g, ''));
      for (let i = 0; i < p.length; i += colunas.length) {
        tabelas[m[1]].push(Object.fromEntries(colunas.map((c, j) => [c, p[i + j]])));
      }
      return [];
    }
    if (sql.startsWith('SELECT id, login FROM cad_login WHERE id IN')) return tabelas.cad_login.filter((l) => p.map(Number).includes(Number(l.id)));
    if (sql === 'SELECT id, login FROM cad_login WHERE id = ?') return tabelas.cad_login.filter((l) => Number(l.id) === Number(p[0]));
    if (sql.startsWith('SELECT id FROM cad_login WHERE login = ?')) return tabelas.cad_login.filter((l) => l.login === p[0]);
    if (sql.startsWith('SELECT id_perfil FROM cad_login_perfil WHERE nome_perfil = ?')) return tabelas.cad_login_perfil.filter((l) => l.nome_perfil === p[0]);
    if (sql.startsWith('SELECT LENGTH(menu_options)')) return [{ tamanho: 4 }];
    if (sql.startsWith('INSERT INTO cad_login_perfil')) {
      const id = Math.max(0, ...tabelas.cad_login_perfil.map((l) => Number(l.id_perfil))) + 1;
      tabelas.cad_login_perfil.push({ id_perfil: id, nome_perfil: p[0], menu_options: p[1] });
      return { insertId: id };
    }
    if (sql.startsWith('INSERT INTO cad_login (login, senha, id_perfil, autoriza)')) {
      const id = Math.max(0, ...tabelas.cad_login.map((l) => Number(l.id))) + 1;
      tabelas.cad_login.push({ id, login: p[0], senha: p[1], id_perfil: p[2], autoriza: 'N' });
      return { insertId: id };
    }
    if (sql.includes('FROM cad_login l')) {
      return tabelas.cad_login.map((l) => ({
        id: l.id,
        login: l.login,
        perfil: tabelas.cad_login_perfil.find((p2) => Number(p2.id_perfil) === Number(l.id_perfil))?.nome_perfil ?? null,
      }));
    }
    throw new Error(`SQL inesperado: ${sql}`);
  };
  const fonte = {
    query,
    createQueryRunner: () => ({ connect: async () => undefined, release: async () => undefined, query }),
  };
  return { fonte, tabelas, comandos, falhar: () => (falharInsercao = true) };
}

function repositorio<T extends Linha>(iniciais: T[] = []) {
  const linhas = iniciais.map((l) => ({ ...l })) as Array<T & Linha>;
  let sequencia = Math.max(0, ...linhas.map((l) => Number(l.id)));
  const combina = (linha: Linha, onde: Linha = {}) =>
    Object.entries(onde).every(([campo, valor]) => {
      if (valor && typeof valor === 'object' && '_value' in (valor as object)) {
        return ((valor as { _value: unknown[] })._value).includes(linha[campo]);
      }
      return linha[campo] === valor;
    });
  const consulta = () => {
    const filtros: Array<(l: Linha) => boolean> = [];
    const construtor = {
      where: (sql: string, params: Linha) => construtor.andWhere(sql, params),
      andWhere: (sql: string, params: Linha) => {
        let m = /^i\.(\w+) = :(\w+)$/.exec(sql);
        if (m) {
          const [, campo, nome] = m;
          filtros.push((l) => l[campo] === params[nome]);
          return construtor;
        }
        m = /^i\.(\w+) IN \(:\.\.\.(\w+)\)$/.exec(sql);
        if (m) {
          const [, campo, nome] = m;
          filtros.push((l) => (params[nome] as unknown[]).includes(l[campo]));
          return construtor;
        }
        m = /^i\.(\w+) <= :(\w+)$/.exec(sql)!;
        const [, campo, nome] = m;
        filtros.push((l) => new Date(l[campo] as Date).getTime() <= (params[nome] as Date).getTime());
        return construtor;
      },
      addSelect: () => construtor,
      getOne: async () => linhas.find((l) => filtros.every((f) => f(l))) ?? null,
      getMany: async () => linhas.filter((l) => filtros.every((f) => f(l))),
    };
    return construtor;
  };
  return {
    linhas,
    create: (dados: Linha) => ({ ...dados }),
    save: async (dados: Linha) => {
      const linha = { criadoEm: new Date(), ...dados, id: ++sequencia } as unknown as T & Linha;
      linhas.push(linha);
      return { ...linha };
    },
    update: async (onde: number | Linha, dados: Linha) => {
      const id = typeof onde === 'number' ? onde : onde.id;
      Object.assign(linhas.find((l) => l.id === id)!, dados);
    },
    findOne: async ({ where }: { where: Linha }) => linhas.find((l) => combina(l, where)) ?? null,
    findOneOrFail: async ({ where }: { where: Linha }) => linhas.find((l) => combina(l, where))!,
    find: async ({ where }: { where?: Linha } = {}) => linhas.filter((l) => combina(l, where)),
    count: async ({ where }: { where: Linha }) => linhas.filter((l) => combina(l, where)).length,
    findAndCount: async ({ where }: { where: Linha }) => {
      const achadas = linhas.filter((l) => combina(l, where)).sort((a, b) => Number(b.id) - Number(a.id));
      return [achadas, achadas.length];
    },
    createQueryBuilder: consulta,
  };
}

function admin(parcial: Partial<UsuarioAutenticado> = {}): UsuarioAutenticado {
  return {
    id: 10,
    nome: 'Admin A',
    email: 'a@a.com',
    login: null,
    papel: 'COMPANY_ADMIN',
    idCargo: null,
    cargo: null,
    permissoes: calcularPermissoes('COMPANY_ADMIN'),
    idEmpresa: 1,
    empresa: { id: 1, nome: 'Loja A', status: 'ACTIVE', banco: 'atrativa_emp_1' },
    idLogin: 1,
    trocarSenha: false,
    administrador: true,
    ...parcial,
  };
}

describe('ImportacoesService', () => {
  let pasta: string;
  let banco: ReturnType<typeof bancoFalso>;
  let usuarios: ReturnType<typeof repositorio>;
  let importacoes: ReturnType<typeof repositorio>;
  let backups: { gerarSegurancaDaEmpresa: ReturnType<typeof vi.fn>; arquivoParaRestaurar: ReturnType<typeof vi.fn> };
  let auditoria: { registrar: ReturnType<typeof vi.fn> };
  let servico: ImportacoesService;

  const enviar = async (conteudo: string | Buffer, nome = 'antigo.sql', usuario = admin()) => {
    await mkdir(servico.pastaRecebidos, { recursive: true });
    const recebido = path.join(servico.pastaRecebidos, `upload-${Math.random()}`);
    await writeFile(recebido, typeof conteudo === 'string' ? Buffer.from(conteudo, 'latin1') : conteudo);
    const resposta = await servico.receber(usuario, { path: recebido, originalname: nome, size: 0 });
    await servico.aguardarTarefas();
    return servico.obter(usuario.idEmpresa!, resposta.id);
  };

  beforeEach(async () => {
    pasta = await mkdtemp(path.join(os.tmpdir(), 'importacoes-'));
    banco = bancoFalso();
    usuarios = repositorio([{ id: 10, idEmpresa: 1, nome: 'Admin A', login: 'ADMIN', papel: 'COMPANY_ADMIN', status: 'ACTIVE', idLoginLegado: 1 }]);
    importacoes = repositorio();
    backups = {
      gerarSegurancaDaEmpresa: vi.fn().mockResolvedValue({ id: 77, status: 'CONCLUIDO' }),
      arquivoParaRestaurar: vi.fn(),
    };
    auditoria = { registrar: vi.fn().mockResolvedValue(undefined) };
    servico = new ImportacoesService(
      importacoes as never,
      usuarios as never,
      repositorio([{ id: 1, nome: 'Loja A', banco: 'atrativa_emp_1', idPlano: null }]) as never,
      repositorio() as never,
      backups as never,
      { obter: vi.fn().mockResolvedValue(banco.fonte) } as never,
      { valores: { backup: { diretorio: pasta }, bcryptRodadas: 4 } } as never,
      auditoria as never,
    );
  });

  afterEach(async () => {
    await servico.aguardarTarefas();
    restauracoes.terminar(1);
    await rm(pasta, { recursive: true, force: true });
  });

  it('analisa o arquivo sem alterar nenhum dado', async () => {
    const analisada = await enviar(DUMP);
    expect(analisada.status).toBe('PRONTO');
    expect(analisada.origem).toBe('DUMP_SQL');
    const analise = analisada.analise as { registros: number; tabelas: Array<{ tabela: string; acao: string }>; usuariosParaCriar: unknown[] };
    expect(analise.registros).toBe(6);
    expect(analise.usuariosParaCriar).toEqual([
      { id: 1, login: 'ATRATIVA', papel: 'COMPANY_ADMIN' },
      { id: 2, login: 'CAIXA', papel: 'SELLER' },
    ]);
    expect(banco.comandos.some((sql) => /^(DELETE|INSERT|UPDATE)/.test(sql))).toBe(false);
    expect(banco.tabelas.cad_clientes).toEqual([{ id: 1, nome_cliente: 'CLIENTE ATUAL', limite_carne: null }]);
    expect(backups.gerarSegurancaDaEmpresa).not.toHaveBeenCalled();
  });

  it('gera o backup de segurança, substitui os dados, mantém o acesso dos usuários atuais e cria os do sistema antigo', async () => {
    const analisada = await enviar(DUMP);
    let durante = false;
    backups.gerarSegurancaDaEmpresa.mockImplementation(async () => {
      durante = restauracoes.emAndamento(1);
      return { id: 77, status: 'CONCLUIDO' };
    });
    const confirmada = await servico.confirmar(admin(), analisada.id);
    expect(confirmada.status).toBe('PROCESSANDO');
    await servico.aguardarTarefas();
    expect(durante).toBe(true);
    expect(restauracoes.emAndamento(1)).toBe(false);

    const final = await servico.obter(1, analisada.id);
    expect(final).toMatchObject({ status: 'CONCLUIDO', idBackupSeguranca: 77, senhasDisponiveis: true });
    expect(backups.gerarSegurancaDaEmpresa).toHaveBeenCalledWith({ id: 1, nome: 'Loja A', banco: 'atrativa_emp_1' }, { id: 10, nome: 'Admin A' });

    expect(banco.tabelas.cad_clientes.map((c) => c.nome_cliente)).toEqual(['MARIA ANTIGA', 'JOSE ANTIGO']);
    expect(banco.tabelas.api_credencial).toHaveLength(1);
    expect(banco.tabelas.cad_login.filter((l) => l.login === 'ATRATIVA' || l.login === 'CAIXA').every((l) => l.senha === null)).toBe(true);

    const adminAtual = usuarios.linhas.find((u) => u.id === 10)!;
    const espelho = banco.tabelas.cad_login.find((l) => Number(l.id) === adminAtual.idLoginLegado)!;
    expect(espelho.login).toBe('ADMIN');
    expect(Number(espelho.id)).toBe(3);

    const criados = usuarios.linhas.filter((u) => u.id !== 10);
    expect(criados).toEqual([
      expect.objectContaining({ login: 'ATRATIVA', papel: 'COMPANY_ADMIN', idLoginLegado: 1, trocarSenha: true, status: 'ACTIVE' }),
      expect.objectContaining({ login: 'CAIXA', papel: 'SELLER', idLoginLegado: 2, trocarSenha: true }),
    ]);
    expect(criados.every((u) => typeof u.senhaHash === 'string' && String(u.senhaHash).startsWith('$2'))).toBe(true);

    const senhas = await servico.retirarSenhas(1, analisada.id);
    expect(senhas.map((s) => s.login)).toEqual(['ATRATIVA', 'CAIXA']);
    expect(senhas.every((s) => s.senhaTemporaria.length === 12)).toBe(true);
    await expect(servico.retirarSenhas(1, analisada.id)).rejects.toBeInstanceOf(NotFoundException);
    expect(JSON.stringify(final.resultado)).not.toMatch(/senhaTemporaria/);
    expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ acao: 'backup.restaurado', idEmpresa: 1 }));
    expect(await readdir(path.join(pasta, 'importacoes', 'empresa-1'))).toEqual([]);
  });

  it('não altera nada quando o backup de segurança falha', async () => {
    const analisada = await enviar(DUMP);
    backups.gerarSegurancaDaEmpresa.mockRejectedValue(new Error('disco cheio'));
    await servico.confirmar(admin(), analisada.id);
    await servico.aguardarTarefas();
    const final = await servico.obter(1, analisada.id);
    expect(final.status).toBe('FALHOU');
    expect(final.erro).toMatch(/backup de segurança; nada foi alterado. disco cheio/);
    expect(banco.tabelas.cad_clientes).toEqual([{ id: 1, nome_cliente: 'CLIENTE ATUAL', limite_carne: null }]);
    expect(banco.comandos.some((sql) => sql.startsWith('DELETE'))).toBe(false);
  });

  it('indica o backup de segurança quando a gravação falha no meio', async () => {
    const analisada = await enviar(DUMP);
    banco.falhar();
    await servico.confirmar(admin(), analisada.id);
    await servico.aguardarTarefas();
    const final = await servico.obter(1, analisada.id);
    expect(final.status).toBe('FALHOU');
    expect(final.erro).toMatch(/carregue o backup de segurança #77/);
    expect(banco.comandos).toContain('ROLLBACK');
    expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ acao: 'backup.restauracao_falhou' }));
  });

  it('isola as importações por empresa e exige confirmação de importação pronta', async () => {
    const analisada = await enviar(DUMP);
    const outra = admin({ id: 20, idEmpresa: 2, empresa: { id: 2, nome: 'Loja B', status: 'ACTIVE', banco: 'atrativa_emp_2' } });
    await expect(servico.obter(2, analisada.id)).rejects.toBeInstanceOf(NotFoundException);
    await expect(servico.confirmar(outra, analisada.id)).rejects.toBeInstanceOf(NotFoundException);
    await servico.cancelar(admin(), analisada.id);
    await expect(servico.confirmar(admin(), analisada.id)).rejects.toBeInstanceOf(ConflictException);
  });

  it('recusa extensões desconhecidas e arquivos ilegíveis', async () => {
    await mkdir(servico.pastaRecebidos, { recursive: true });
    const recebido = path.join(servico.pastaRecebidos, 'x');
    await writeFile(recebido, 'x');
    await expect(servico.receber(admin(), { path: recebido, originalname: 'planilha.xlsx', size: 1 })).rejects.toBeInstanceOf(BadRequestException);
    const ruim = await enviar('isto não é um dump');
    expect(ruim.status).toBe('FALHOU');
    expect(ruim.erro).toMatch(/Nenhuma tabela/);
    const zipFalso = await enviar(Buffer.from('PK\u0003\u0004lixo'), 'backup.zip');
    expect(zipFalso.status).toBe('FALHOU');
  });

  it('bloqueia alterações da empresa enquanto a restauração está em andamento', () => {
    const guard = new AcessoGuard(new Reflector());
    const contexto = (method: string) =>
      ({
        getHandler: () => () => undefined,
        getClass: () => class {},
        switchToHttp: () => ({ getRequest: () => ({ user: admin(), method }) }),
      }) as unknown as ExecutionContext;
    restauracoes.iniciar(1);
    expect(() => guard.canActivate(contexto('POST'))).toThrow(ServiceUnavailableException);
    expect(guard.canActivate(contexto('GET'))).toBe(true);
    restauracoes.terminar(1);
    expect(guard.canActivate(contexto('POST'))).toBe(true);
  });
});
