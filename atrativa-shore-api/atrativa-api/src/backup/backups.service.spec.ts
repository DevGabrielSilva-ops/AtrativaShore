import { createHash } from 'node:crypto';
import { mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ForbiddenException, GoneException, NotFoundException, ConflictException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CHAVE_ESCOPO, CHAVE_PERMISSOES } from '../acesso/acesso.decorators.js';
import { AcessoGuard } from '../acesso/acesso.guard.js';
import { calcularPermissoes } from '../acesso/permissoes.js';
import type { UsuarioAutenticado } from '../auth/usuario-autenticado.js';
import type { Backup } from '../plataforma/entities/index.js';
import { BackupsController, BackupsPlataformaController } from './backups.controller.js';
import { BackupsService, slugArquivo } from './backups.service.js';
import { exportarEmpresa } from './exportador-empresa.js';
import { lerZip } from './ler-zip.js';

vi.mock('./exportador-empresa.js', () => ({ exportarEmpresa: vi.fn() }));

const exportar = vi.mocked(exportarEmpresa);

type Registro = Backup & Record<string, unknown>;

function repositorioBackups() {
  const linhas: Registro[] = [];
  let sequencia = 0;
  const combina = (linha: Registro, onde: Record<string, unknown>) =>
    Object.entries(onde).every(([campo, valor]) => linha[campo] === valor);
  const consulta = () => {
    const filtros: Array<(l: Registro) => boolean> = [];
    const construtor = {
      where: (sql: string, params: Record<string, unknown>) => construtor.andWhere(sql, params),
      andWhere: (sql: string, params: Record<string, unknown>) => {
        const [, campo, operador, nome] = /^b\.(\w+) (=|<=) :(\w+)$/.exec(sql)!;
        const valor = params[nome];
        filtros.push((l) =>
          operador === '=' ? l[campo] === valor : new Date(l[campo] as Date).getTime() <= (valor as Date).getTime(),
        );
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
    create: (dados: Partial<Registro>) => ({ downloads: 0, progresso: 0, tamanho: null, sha256: null, registros: null, erro: null, concluidoEm: null, expiraEm: null, ultimoDownloadEm: null, etapa: null, ...dados }) as Registro,
    save: async (dados: Registro) => {
      const linha = { ...dados, id: ++sequencia, criadoEm: new Date() } as Registro;
      linhas.push(linha);
      return { ...linha };
    },
    update: async (id: number, dados: Partial<Registro>) => {
      Object.assign(linhas.find((l) => l.id === id)!, dados);
    },
    increment: async ({ id }: { id: number }, campo: string, valor: number) => {
      const linha = linhas.find((l) => l.id === id)!;
      linha[campo] = (linha[campo] as number) + valor;
    },
    findOne: async ({ where }: { where: Record<string, unknown> }) => {
      const achadas = linhas.filter((l) => combina(l, where));
      return achadas.at(-1) ?? null;
    },
    findAndCount: async ({ where, skip, take }: { where: Record<string, unknown>; skip: number; take: number }) => {
      const achadas = linhas.filter((l) => combina(l, where)).sort((a, b) => b.id - a.id);
      return [achadas.slice(skip, skip + take), achadas.length];
    },
    createQueryBuilder: consulta,
  };
}

function usuario(parcial: Partial<UsuarioAutenticado> = {}): UsuarioAutenticado {
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
    empresa: { id: 1, nome: 'Loja Açaí São João', status: 'ACTIVE', banco: 'atrativa_emp_1' },
    idLogin: 1,
    trocarSenha: false,
    administrador: true,
    ...parcial,
  };
}

const adminB = () =>
  usuario({ id: 20, nome: 'Admin B', idEmpresa: 2, empresa: { id: 2, nome: 'Loja B', status: 'ACTIVE', banco: 'atrativa_emp_2' } });

describe('BackupsService', () => {
  let diretorio: string;
  let backups: ReturnType<typeof repositorioBackups>;
  let auditoria: { registrar: ReturnType<typeof vi.fn> };
  let conexoes: { obter: ReturnType<typeof vi.fn> };
  let servico: BackupsService;

  beforeEach(async () => {
    diretorio = await mkdtemp(path.join(os.tmpdir(), 'backups-'));
    backups = repositorioBackups();
    auditoria = { registrar: vi.fn().mockResolvedValue(undefined) };
    conexoes = { obter: vi.fn().mockResolvedValue({ banco: 'fonte' }) };
    exportar.mockReset();
    exportar.mockImplementation(async (_fonte, _plataforma, zip) => {
      await zip.adicionar('metadados.json', '{"versaoFormato":1}');
      await zip.adicionar('dados/empresa/cad_clientes.json', '{"linhas":[{"id":1}]}');
      return { arquivos: [], registros: 1 };
    });
    servico = new BackupsService(
      backups as never,
      { find: vi.fn().mockResolvedValue([]) } as never,
      { find: vi.fn().mockResolvedValue([{ id: 10, nome: 'Admin A' }, { id: 20, nome: 'Admin B' }]) } as never,
      {} as never,
      conexoes as never,
      { valores: { backup: { diretorio, retencaoHoras: 24, mysqldump: null }, plataforma: { banco: 'central' } }, fusoHorario: 'America/Sao_Paulo' } as never,
      auditoria as never,
    );
  });

  afterEach(async () => {
    await servico.aguardarGeracoes();
    await rm(diretorio, { recursive: true, force: true });
  });

  it('gera o backup em segundo plano e permite baixar um ZIP íntegro', async () => {
    const inicial = await servico.gerarDaEmpresa(usuario());
    expect(inicial.status).toBe('PROCESSANDO');
    expect(inicial.nomeArquivo).toMatch(/^atrativa-shore-backup-loja-acai-sao-joao-\d{4}-\d{2}-\d{2}\.zip$/);
    await servico.aguardarGeracoes();

    const pronto = await servico.obter({ tipo: 'EMPRESA', idEmpresa: 1 }, inicial.id);
    expect(pronto).toMatchObject({ status: 'CONCLUIDO', progresso: 100, disponivel: true, registros: 1, usuario: { id: 10, nome: 'Admin A' } });
    expect(conexoes.obter).toHaveBeenCalledWith('atrativa_emp_1');
    expect(exportar.mock.calls[0][3]).toMatchObject({ idEmpresa: 1, nomeEmpresa: 'Loja Açaí São João' });

    const arquivo = await servico.abrirDownload({ tipo: 'EMPRESA', idEmpresa: 1 }, inicial.id, usuario());
    const partes: Buffer[] = [];
    for await (const parte of arquivo.stream) partes.push(parte as Buffer);
    const conteudo = Buffer.concat(partes);
    expect(arquivo.nome).toBe(inicial.nomeArquivo);
    expect(conteudo.length).toBe(arquivo.tamanho);
    expect(createHash('sha256').update(conteudo).digest('hex')).toBe(pronto.sha256);
    expect([...lerZip(conteudo).keys()]).toEqual(['metadados.json', 'dados/empresa/cad_clientes.json']);

    const acoes = auditoria.registrar.mock.calls.map(([r]) => (r as { acao: string; idEmpresa: number }));
    expect(acoes).toEqual([
      expect.objectContaining({ acao: 'backup.gerado', idEmpresa: 1, idUsuario: 10 }),
      expect.objectContaining({ acao: 'backup.baixado', idEmpresa: 1, idUsuario: 10 }),
    ]);
    expect((await servico.obter({ tipo: 'EMPRESA', idEmpresa: 1 }, inicial.id)).downloads).toBe(1);
  });

  it('não reaproveita nem expõe o caminho do arquivo e grava fora de pastas públicas', async () => {
    const { id } = await servico.gerarDaEmpresa(usuario());
    await servico.aguardarGeracoes();
    const resposta = await servico.obter({ tipo: 'EMPRESA', idEmpresa: 1 }, id);
    expect(resposta).not.toHaveProperty('caminho');
    expect(await readdir(path.join(diretorio, 'empresa-1'))).toEqual([expect.stringMatching(/^[0-9a-f-]{36}\.zip$/)]);
  });

  it('marca como falha sem lançar erro e sem deixar arquivos quando a exportação quebra', async () => {
    exportar.mockImplementationOnce(async (_f, _p, zip) => {
      await zip.adicionar('metadados.json', 'parcial');
      throw new Error('Lost connection to MySQL server');
    });
    const inicial = await servico.gerarDaEmpresa(usuario());
    await servico.aguardarGeracoes();
    const falha = await servico.obter({ tipo: 'EMPRESA', idEmpresa: 1 }, inicial.id);
    expect(falha).toMatchObject({ status: 'FALHOU', disponivel: false, erro: 'Lost connection to MySQL server' });
    expect(await readdir(path.join(diretorio, 'empresa-1'))).toEqual([]);
    expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ acao: 'backup.falhou', idEmpresa: 1 }));
    await expect(servico.abrirDownload({ tipo: 'EMPRESA', idEmpresa: 1 }, inicial.id, usuario())).rejects.toBeInstanceOf(GoneException);

    const novo = await servico.gerarDaEmpresa(usuario());
    expect(novo.id).not.toBe(inicial.id);
  });

  it('reaproveita a geração em andamento em vez de iniciar outra', async () => {
    let liberar!: () => void;
    exportar.mockImplementationOnce(async () => {
      await new Promise<void>((resolver) => (liberar = resolver));
      return { arquivos: [], registros: 0 };
    });
    const primeiro = await servico.gerarDaEmpresa(usuario());
    const segundo = await servico.gerarDaEmpresa(usuario());
    expect(segundo.id).toBe(primeiro.id);
    await expect(servico.abrirDownload({ tipo: 'EMPRESA', idEmpresa: 1 }, primeiro.id, usuario())).rejects.toBeInstanceOf(
      ConflictException,
    );
    await vi.waitFor(() => expect(liberar).toBeTypeOf('function'));
    liberar();
  });

  it('isola os backups por empresa e separa os globais', async () => {
    const { id } = await servico.gerarDaEmpresa(usuario());
    await servico.aguardarGeracoes();
    const escopoB = servico.escopoDaEmpresa(adminB());
    await expect(servico.obter(escopoB, id)).rejects.toBeInstanceOf(NotFoundException);
    await expect(servico.abrirDownload(escopoB, id, adminB())).rejects.toBeInstanceOf(NotFoundException);
    await expect(servico.obter(servico.escopoPlataforma, id)).rejects.toBeInstanceOf(NotFoundException);
    expect((await servico.listar(escopoB, { page: 1, limit: 20 })).data).toEqual([]);
    expect((await servico.listar(servico.escopoPlataforma, { page: 1, limit: 20 })).data).toEqual([]);

    const historico = await servico.listar(servico.escopoDaEmpresa(usuario()), { page: 1, limit: 20 });
    expect(historico.meta.total).toBe(1);
    expect(historico.data[0]).toMatchObject({ id, status: 'CONCLUIDO', usuario: { nome: 'Admin A' } });
  });

  it('exige usuário de empresa para o backup individual', () => {
    expect(() => servico.escopoDaEmpresa(usuario({ papel: 'SUPER_ADMIN', idEmpresa: null, empresa: null }))).toThrow(ForbiddenException);
  });

  it('remove os arquivos expirados e bloqueia o download', async () => {
    const { id } = await servico.gerarDaEmpresa(usuario());
    await servico.aguardarGeracoes();
    backups.linhas[0].expiraEm = new Date(Date.now() - 1000);
    expect((await servico.obter({ tipo: 'EMPRESA', idEmpresa: 1 }, id)).status).toBe('EXPIRADO');
    expect(await servico.limparExpirados()).toBe(1);
    expect(await readdir(path.join(diretorio, 'empresa-1'))).toEqual([]);
    expect(backups.linhas[0].status).toBe('EXPIRADO');
    await expect(servico.abrirDownload({ tipo: 'EMPRESA', idEmpresa: 1 }, id, usuario())).rejects.toBeInstanceOf(GoneException);
  });

  it('marca como falha as gerações interrompidas por reinício', async () => {
    await backups.save(backups.create({ tipo: 'EMPRESA', idEmpresa: 1, status: 'PROCESSANDO', nomeArquivo: 'x.zip', caminho: 'empresa-1/x.zip', criadoPor: 10 }));
    await servico.onApplicationBootstrap();
    await servico.onModuleDestroy();
    expect(backups.linhas[0]).toMatchObject({ status: 'FALHOU', caminho: null });
  });

  it('gera nomes de arquivo seguros', () => {
    expect(slugArquivo('Loja Açaí & Cia. LTDA')).toBe('loja-acai-cia-ltda');
    expect(slugArquivo('../../etc')).toBe('etc');
    expect(slugArquivo('***')).toBe('empresa');
  });

  it.skipIf(process.platform === 'win32')('grava o arquivo legível apenas pelo usuário do servidor', async () => {
    await servico.gerarDaEmpresa(usuario());
    await servico.aguardarGeracoes();
    const [nome] = await readdir(path.join(diretorio, 'empresa-1'));
    expect((await stat(path.join(diretorio, 'empresa-1', nome))).mode & 0o077).toBe(0);
  });
});

describe('permissões do backup', () => {
  const guard = new AcessoGuard(new Reflector());
  const contexto = (user: UsuarioAutenticado, alvo: object) =>
    ({
      getHandler: () => () => undefined,
      getClass: () => alvo,
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    }) as unknown as ExecutionContext;

  it('exige backup.gerar nas rotas da empresa e escopo de plataforma no backup global', () => {
    expect(Reflect.getMetadata(CHAVE_PERMISSOES, BackupsController)).toEqual(['backup.gerar']);
    expect(Reflect.getMetadata(CHAVE_ESCOPO, BackupsPlataformaController)).toBe('PLATAFORMA');
  });

  it('libera o administrador da empresa e bloqueia gerente, vendedor e estoquista sem permissão explícita', () => {
    expect(guard.canActivate(contexto(usuario(), BackupsController))).toBe(true);
    for (const papel of ['MANAGER', 'SELLER', 'STOCK_OPERATOR'] as const) {
      const funcionario = usuario({ papel, permissoes: calcularPermissoes(papel), administrador: false });
      expect(() => guard.canActivate(contexto(funcionario, BackupsController))).toThrow(ForbiddenException);
    }
  });

  it('libera funcionário cujo cargo recebeu a permissão', () => {
    const vendedor = usuario({ papel: 'SELLER', permissoes: calcularPermissoes('SELLER', ['vendas.registrar', 'backup.gerar']) });
    expect(guard.canActivate(contexto(vendedor, BackupsController))).toBe(true);
  });

  it('impede administradores de empresa de usar o backup global e o superadministrador de usar o da empresa', () => {
    expect(() => guard.canActivate(contexto(usuario(), BackupsPlataformaController))).toThrow(ForbiddenException);
    const superAdmin = usuario({ papel: 'SUPER_ADMIN', permissoes: [], idEmpresa: null, empresa: null });
    expect(guard.canActivate(contexto(superAdmin, BackupsPlataformaController))).toBe(true);
    expect(() => guard.canActivate(contexto(superAdmin, BackupsController))).toThrow(ForbiddenException);
  });
});
