import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { copyFile, mkdir, readdir, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import bcrypt from 'bcrypt';
import { type DataSource, In, type Repository } from 'typeorm';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { CONEXAO_PLATAFORMA } from '../auth/sessao-usuario.service.js';
import type { UsuarioAutenticado } from '../auth/usuario-autenticado.js';
import { offset, paginado, type Paginado } from '../common/dto/paginacao.dto.js';
import { senhaTemporaria } from '../common/utils/segredos.js';
import { ConfiguracaoService } from '../config/configuracao.service.js';
import {
  Importacao,
  Plano,
  PlataformaEmpresa,
  PlataformaUsuario,
  type StatusImportacao,
} from '../plataforma/entities/index.js';
import { ConexoesEmpresaService } from '../tenancy/conexoes-empresa.service.js';
import { PERFIL_ACESSO_WEB, criarLoginEspelho } from '../tenancy/provisionamento.js';
import { BackupsService } from './backups.service.js';
import { restauracoes } from './bloqueio.js';
import { abrirFonte } from './fonte-importacao.js';
import { aplicar, analisar, lerEsquema, type UsuarioLegado } from './importador.js';

export interface ArquivoRecebido {
  path: string;
  originalname: string;
  size: number;
}

export interface UsuarioCriado {
  id: number;
  nome: string;
  login: string;
  papel: string;
  status: string;
  idLogin: number;
}

export interface ImportacaoResposta {
  id: number;
  status: StatusImportacao;
  origem: string | null;
  nomeArquivo: string;
  tamanho: number | null;
  progresso: number;
  etapa: string | null;
  erro: string | null;
  analise: Record<string, unknown> | null;
  resultado: Record<string, unknown> | null;
  idBackupOrigem: number | null;
  idBackupSeguranca: number | null;
  criadoEm: string;
  confirmadoEm: string | null;
  concluidoEm: string | null;
  senhasDisponiveis: boolean;
  usuario: { id: number; nome: string } | null;
}

const EXTENSOES = ['.zip', '.sql'];
const RETENCAO_ANALISE_HORAS = 24;
const INTERVALO_LIMPEZA_MS = 30 * 60 * 1000;
const INTERVALO_PROGRESSO_MS = 700;

function mensagemDeErro(erro: unknown): string {
  const texto = erro instanceof Error ? erro.message : String(erro);
  return texto.replace(/\s+/g, ' ').trim().slice(0, 250) || 'Falha desconhecida';
}

function comoTexto(valor: Date | string | null): string | null {
  if (valor === null) return null;
  return valor instanceof Date ? valor.toISOString() : valor;
}

export function papelDoPerfil(perfil: string | null): 'COMPANY_ADMIN' | 'SELLER' {
  return perfil?.trim().toUpperCase() === 'ADMINISTRADOR' ? 'COMPANY_ADMIN' : 'SELLER';
}

@Injectable()
export class ImportacoesService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger('Importacoes');
  private readonly senhas = new Map<number, Array<{ id: number; nome: string; login: string; senhaTemporaria: string }>>();
  private readonly tarefas = new Set<Promise<void>>();
  private temporizador: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(Importacao, CONEXAO_PLATAFORMA) private readonly importacoes: Repository<Importacao>,
    @InjectRepository(PlataformaUsuario, CONEXAO_PLATAFORMA) private readonly usuarios: Repository<PlataformaUsuario>,
    @InjectRepository(PlataformaEmpresa, CONEXAO_PLATAFORMA) private readonly empresas: Repository<PlataformaEmpresa>,
    @InjectRepository(Plano, CONEXAO_PLATAFORMA) private readonly planos: Repository<Plano>,
    private readonly backups: BackupsService,
    private readonly conexoes: ConexoesEmpresaService,
    private readonly config: ConfiguracaoService,
    private readonly auditoria: AuditoriaService,
  ) {}

  get pastaBase(): string {
    return path.resolve(this.config.valores.backup.diretorio, 'importacoes');
  }

  get pastaRecebidos(): string {
    return path.join(this.pastaBase, 'recebidos');
  }

  async onApplicationBootstrap(): Promise<void> {
    try {
      const interrompidas = await this.importacoes
        .createQueryBuilder('i')
        .addSelect('i.caminho')
        .where('i.status IN (:...status)', { status: ['ANALISANDO', 'PROCESSANDO'] })
        .getMany();
      for (const importacao of interrompidas) {
        const erro =
          importacao.status === 'PROCESSANDO'
            ? `Restauração interrompida pelo reinício do servidor. Os dados podem estar incompletos: carregue o backup de segurança #${importacao.idBackupSeguranca ?? '—'}.`
            : 'Análise interrompida pelo reinício do servidor. Envie o arquivo novamente.';
        await this.apagarArquivo(importacao.caminho);
        await this.importacoes.update(importacao.id, { status: 'FALHOU', erro: erro.slice(0, 255), caminho: null, concluidoEm: new Date() });
      }
      await this.limpar();
    } catch (erro) {
      this.logger.warn(`Não foi possível revisar as importações pendentes: ${mensagemDeErro(erro)}`);
    }
    this.temporizador = setInterval(() => {
      void this.limpar().catch((erro) => this.logger.warn(`Falha na limpeza de importações: ${mensagemDeErro(erro)}`));
    }, INTERVALO_LIMPEZA_MS);
    this.temporizador.unref();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.temporizador) clearInterval(this.temporizador);
    await Promise.allSettled([...this.tarefas]);
  }

  aguardarTarefas(): Promise<unknown> {
    return Promise.allSettled([...this.tarefas]);
  }

  private empresaDe(usuario: UsuarioAutenticado) {
    if (!usuario.idEmpresa || !usuario.empresa) throw new BadRequestException('Esta área é exclusiva das empresas');
    return { id: usuario.idEmpresa, nome: usuario.empresa.nome, banco: usuario.empresa.banco };
  }

  async receber(usuario: UsuarioAutenticado, arquivo: ArquivoRecebido | undefined): Promise<ImportacaoResposta> {
    if (!arquivo) throw new BadRequestException('Envie o arquivo do backup no campo "arquivo"');
    const empresa = this.empresaDe(usuario);
    const extensao = path.extname(arquivo.originalname).toLowerCase();
    if (!EXTENSOES.includes(extensao)) {
      await rm(arquivo.path, { force: true }).catch(() => undefined);
      throw new BadRequestException('Envie um backup .zip do Atrativa Shore ou um dump .sql do MySQL');
    }
    const recebido = path.resolve(arquivo.path);
    if (!recebido.startsWith(this.pastaRecebidos + path.sep)) throw new BadRequestException('Arquivo inválido');
    try {
      return await this.registrar(empresa.id, usuario.id, arquivo.originalname, extensao, null, (destino) => rename(recebido, destino));
    } finally {
      await rm(recebido, { force: true }).catch(() => undefined);
    }
  }

  async deBackup(usuario: UsuarioAutenticado, idBackup: number): Promise<ImportacaoResposta> {
    const empresa = this.empresaDe(usuario);
    const { caminho, nome } = await this.backups.arquivoParaRestaurar({ tipo: 'EMPRESA', idEmpresa: empresa.id }, idBackup);
    return this.registrar(empresa.id, usuario.id, nome, '.zip', idBackup, (destino) => copyFile(caminho, destino));
  }

  private async registrar(
    idEmpresa: number,
    idUsuario: number,
    nomeOriginal: string,
    extensao: string,
    idBackupOrigem: number | null,
    gravar: (destino: string) => Promise<void>,
  ): Promise<ImportacaoResposta> {
    const relativo = path.posix.join(`empresa-${idEmpresa}`, `${randomUUID()}${extensao}`);
    const destino = path.join(this.pastaBase, relativo);
    await mkdir(path.dirname(destino), { recursive: true, mode: 0o700 });
    await gravar(destino);
    const { size } = await stat(destino);
    const nome = path.basename(nomeOriginal).replace(/[^\p{L}\p{N}._ ()-]/gu, '_').slice(0, 200) || `backup${extensao}`;
    const importacao = await this.importacoes.save(
      this.importacoes.create({
        idEmpresa,
        status: 'ANALISANDO',
        nomeArquivo: nome,
        caminho: relativo,
        tamanho: String(size),
        progresso: 0,
        etapa: 'Lendo o arquivo',
        idBackupOrigem,
        criadoPor: idUsuario,
      }),
    );
    this.agendar(this.executarAnalise(importacao.id));
    return this.obter(idEmpresa, importacao.id);
  }

  async listar(idEmpresa: number, paginacao: { page: number; limit: number }): Promise<Paginado<ImportacaoResposta>> {
    const [linhas, total] = await this.importacoes.findAndCount({
      where: { idEmpresa },
      order: { id: 'DESC' },
      skip: offset(paginacao),
      take: paginacao.limit,
    });
    return paginado(await this.responder(linhas), total, paginacao.page, paginacao.limit);
  }

  async obter(idEmpresa: number, id: number): Promise<ImportacaoResposta> {
    const [resposta] = await this.responder([await this.buscar(idEmpresa, id)]);
    return resposta;
  }

  async cancelar(usuario: UsuarioAutenticado, id: number): Promise<ImportacaoResposta> {
    const empresa = this.empresaDe(usuario);
    const importacao = await this.buscar(empresa.id, id, true);
    if (importacao.status !== 'PRONTO' && importacao.status !== 'FALHOU') {
      throw new ConflictException('Só é possível cancelar uma importação analisada que ainda não foi confirmada');
    }
    await this.apagarArquivo(importacao.caminho);
    if (importacao.status === 'PRONTO') {
      await this.importacoes.update(id, { status: 'CANCELADO', caminho: null, etapa: 'Cancelada', concluidoEm: new Date() });
    }
    return this.obter(empresa.id, id);
  }

  async retirarSenhas(idEmpresa: number, id: number) {
    await this.buscar(idEmpresa, id);
    const senhas = this.senhas.get(id);
    if (!senhas) throw new NotFoundException('As senhas temporárias já foram exibidas ou não existem mais');
    this.senhas.delete(id);
    return senhas;
  }

  async confirmar(usuario: UsuarioAutenticado, id: number): Promise<ImportacaoResposta> {
    const empresa = this.empresaDe(usuario);
    const importacao = await this.buscar(empresa.id, id, true);
    if (importacao.status !== 'PRONTO') throw new ConflictException('Esta importação não está pronta para ser confirmada');
    if (restauracoes.emAndamento(empresa.id)) throw new ConflictException('Já existe uma restauração em andamento nesta empresa');
    const emCurso = await this.importacoes.findOne({ where: { idEmpresa: empresa.id, status: 'PROCESSANDO' } });
    if (emCurso) throw new ConflictException('Já existe uma restauração em andamento nesta empresa');

    restauracoes.iniciar(empresa.id);
    try {
      await this.importacoes.update(id, {
        status: 'PROCESSANDO',
        progresso: 1,
        etapa: 'Na fila',
        confirmadoPor: usuario.id,
        confirmadoEm: new Date(),
      });
    } catch (erro) {
      restauracoes.terminar(empresa.id);
      throw erro;
    }
    this.agendar(
      this.executarRestauracao(importacao, empresa, { id: usuario.id, nome: usuario.nome }).finally(() => restauracoes.terminar(empresa.id)),
    );
    return this.obter(empresa.id, id);
  }

  private agendar(tarefa: Promise<void>): void {
    const registrada = tarefa.finally(() => this.tarefas.delete(registrada));
    this.tarefas.add(registrada);
  }

  private progressoDe(id: number) {
    let ultimo = 0;
    let ultimoPercentual = -1;
    return async (percentual: number, etapa: string, forcar = false) => {
      const agora = Date.now();
      if (!forcar && (percentual === ultimoPercentual || agora - ultimo < INTERVALO_PROGRESSO_MS)) return;
      ultimo = agora;
      ultimoPercentual = percentual;
      await this.importacoes.update(id, { progresso: Math.max(0, Math.min(100, percentual)), etapa: etapa.slice(0, 120) }).catch(() => undefined);
    };
  }

  private async executarAnalise(id: number): Promise<void> {
    const importacao = await this.buscarPorId(id);
    const progresso = this.progressoDe(id);
    try {
      const caminho = this.caminhoAbsoluto(importacao.caminho)!;
      const sha256 = await this.hash(caminho);
      const fonte = await abrirFonte(caminho);
      const empresa = await this.empresas.findOneOrFail({ where: { id: importacao.idEmpresa } });
      const esquema = await lerEsquema(await this.conexoes.obter(empresa.banco));
      const analise = await analisar(fonte, esquema, (registros) => void progresso(Math.min(95, 5 + Math.floor(registros / 2000)), `Lendo registros (${registros})`));
      const avisos = [...analise.avisos];
      if (fonte.metadados?.empresa && fonte.metadados.empresa.id !== importacao.idEmpresa) {
        avisos.unshift(`Este backup foi gerado por outra empresa (${fonte.metadados.empresa.nome}). Os dados dela vão substituir os desta empresa.`);
      }
      const naoTransacionais = analise.tabelas.filter((t) => t.acao === 'SUBSTITUIR' && !t.transacional).map((t) => t.tabela);
      const usuariosParaCriar = (await this.loginsParaCriar(importacao.idEmpresa, analise.usuariosLegados)).map((u) => ({
        id: u.id,
        login: u.login,
        papel: papelDoPerfil(u.perfil),
      }));
      const resumo: Record<string, unknown> = {
        origem: fonte.origem,
        codificacao: fonte.codificacao,
        metadados: fonte.metadados,
        registros: analise.registros,
        tabelas: analise.tabelas,
        usuariosParaCriar,
        naoTransacionais,
        avisos,
      };
      await this.importacoes.update(id, {
        status: 'PRONTO',
        origem: fonte.origem,
        sha256,
        progresso: 100,
        etapa: 'Aguardando confirmação',
        analise: resumo as never,
      });
    } catch (erro) {
      const mensagem = mensagemDeErro(erro);
      await this.apagarArquivo(importacao.caminho);
      await this.importacoes
        .update(id, { status: 'FALHOU', erro: `Arquivo não pôde ser lido: ${mensagem}`.slice(0, 255), etapa: 'Falhou', caminho: null, concluidoEm: new Date() })
        .catch(() => undefined);
    }
  }

  private async loginsParaCriar(idEmpresa: number, legados: UsuarioLegado[]): Promise<UsuarioLegado[]> {
    const candidatos = legados.filter((u) => (u.perfil ?? '').trim().toUpperCase() !== PERFIL_ACESSO_WEB);
    if (!candidatos.length) return [];
    const vinculados = await this.usuarios.find({ where: { idEmpresa, idLoginLegado: In(candidatos.map((u) => u.id)) }, select: { id: true, login: true, idLoginLegado: true } });
    const porId = new Map(vinculados.map((u) => [u.idLoginLegado, u]));
    return candidatos.filter((u) => {
      const existente = porId.get(u.id);
      return !existente || (existente.login ?? '').toUpperCase() !== (u.login ?? '').toUpperCase();
    });
  }

  private async executarRestauracao(
    inicial: Importacao,
    empresa: { id: number; nome: string; banco: string },
    autor: { id: number; nome: string },
  ): Promise<void> {
    const id = inicial.id;
    const progresso = this.progressoDe(id);
    let idSeguranca: number | null = null;
    let iniciouGravacao = false;
    try {
      await progresso(3, 'Gerando backup de segurança', true);
      const seguranca = await this.backups.gerarSegurancaDaEmpresa(empresa, autor).catch((erro: unknown) => {
        throw new Error(`Não foi possível gerar o backup de segurança; nada foi alterado. ${mensagemDeErro(erro)}`);
      });
      idSeguranca = seguranca.id;
      await this.importacoes.update(id, { idBackupSeguranca: seguranca.id });

      const fonteEmpresa = await this.conexoes.obter(empresa.banco);
      const usuariosAntes = await this.usuarios.find({ where: { idEmpresa: empresa.id } });
      const loginsAntes = new Map<number, string | null>();
      const idsLegados = usuariosAntes.map((u) => u.idLoginLegado).filter((v): v is number => v !== null);
      if (idsLegados.length) {
        const linhas = (await fonteEmpresa.query(`SELECT id, login FROM cad_login WHERE id IN (${idsLegados.map(() => '?').join(',')})`, idsLegados)) as Array<{
          id: number;
          login: string | null;
        }>;
        for (const linha of linhas) loginsAntes.set(Number(linha.id), linha.login);
      }

      const caminho = this.caminhoAbsoluto(inicial.caminho)!;
      const fonte = await abrirFonte(caminho);
      const esquema = await lerEsquema(fonteEmpresa);
      const analise = (inicial.analise ?? {}) as { registros?: number };
      const total = Math.max(1, Number(analise.registros ?? 0));

      await progresso(20, 'Substituindo os dados', true);
      const executor = fonteEmpresa.createQueryRunner();
      await executor.connect();
      let resultado;
      try {
        await executor.query("SET SESSION foreign_key_checks = 0, unique_checks = 0, sql_mode = 'NO_AUTO_VALUE_ON_ZERO'");
        await executor.query('START TRANSACTION');
        iniciouGravacao = true;
        resultado = await aplicar(executor, fonte, esquema, (registros, tabela) =>
          progresso(20 + Math.round((Math.min(registros, total) / total) * 65), `Restaurando ${tabela}`),
        );
        await executor.query('COMMIT');
      } catch (erro) {
        await executor.query('ROLLBACK').catch(() => undefined);
        throw erro;
      } finally {
        await executor.query("SET SESSION foreign_key_checks = 1, unique_checks = 1, sql_mode = DEFAULT").catch(() => undefined);
        await executor.release();
      }

      await progresso(88, 'Atualizando os acessos', true);
      const religados = await this.religarLogins(fonteEmpresa, empresa.id, usuariosAntes, loginsAntes);
      const legados = await this.lerLoginsLegados(fonteEmpresa);
      const criados = await this.criarUsuarios(empresa.id, autor.id, await this.loginsParaCriar(empresa.id, legados));

      await this.apagarArquivo(inicial.caminho);
      await this.importacoes.update(id, {
        status: 'CONCLUIDO',
        progresso: 100,
        etapa: 'Concluída',
        caminho: null,
        concluidoEm: new Date(),
        resultado: {
          registros: resultado.registros,
          tabelas: resultado.tabelas,
          usuariosCriados: criados.map(({ senhaTemporaria: _senha, ...u }) => u),
          loginsReligados: religados,
        },
      });
      if (criados.length) this.senhas.set(id, criados.map((u) => ({ id: u.id, nome: u.nome, login: u.login, senhaTemporaria: u.senhaTemporaria })));
      await this.auditoria.registrar({
        acao: 'backup.restaurado',
        entidade: 'importacao',
        idEntidade: id,
        idUsuario: autor.id,
        idEmpresa: empresa.id,
        detalhes: {
          arquivo: inicial.nomeArquivo,
          origem: inicial.origem,
          registros: resultado.registros,
          tabelas: resultado.tabelas.length,
          usuariosCriados: criados.length,
          backupSeguranca: idSeguranca,
        },
      });
    } catch (erro) {
      const mensagem = mensagemDeErro(erro);
      this.logger.error(`Importação ${id} falhou: ${mensagem}`);
      const final = iniciouGravacao && idSeguranca
        ? `${mensagem} Os dados podem ter ficado incompletos: carregue o backup de segurança #${idSeguranca}.`
        : mensagem;
      await this.apagarArquivo(inicial.caminho);
      await this.importacoes
        .update(id, { status: 'FALHOU', etapa: 'Falhou', erro: final.slice(0, 255), caminho: null, concluidoEm: new Date() })
        .catch(() => undefined);
      await this.auditoria.registrar({
        acao: 'backup.restauracao_falhou',
        entidade: 'importacao',
        idEntidade: id,
        idUsuario: autor.id,
        idEmpresa: empresa.id,
        detalhes: { arquivo: inicial.nomeArquivo, erro: mensagem, backupSeguranca: idSeguranca },
      });
    }
  }

  private async religarLogins(
    fonte: DataSource,
    idEmpresa: number,
    usuarios: PlataformaUsuario[],
    loginsAntes: Map<number, string | null>,
  ): Promise<number> {
    let religados = 0;
    for (const usuario of usuarios) {
      if (usuario.idLoginLegado === null) continue;
      const loginAntigo = loginsAntes.get(usuario.idLoginLegado) ?? null;
      const [atual] = (await fonte.query('SELECT id, login FROM cad_login WHERE id = ?', [usuario.idLoginLegado])) as Array<{
        id: number;
        login: string | null;
      }>;
      if (atual && (atual.login ?? '').toUpperCase() === (loginAntigo ?? '').toUpperCase()) continue;
      let novo: number | null = null;
      if (loginAntigo) {
        const [mesmoLogin] = (await fonte.query('SELECT id FROM cad_login WHERE login = ? ORDER BY id LIMIT 1', [loginAntigo])) as Array<{ id: number }>;
        const ocupado = mesmoLogin
          ? await this.usuarios.findOne({ where: { idEmpresa, idLoginLegado: Number(mesmoLogin.id) } })
          : null;
        if (mesmoLogin && !ocupado) novo = Number(mesmoLogin.id);
      }
      novo ??= await criarLoginEspelho(fonte, usuario.login ?? usuario.nome);
      await this.usuarios.update({ id: usuario.id }, { idLoginLegado: novo });
      religados += 1;
    }
    return religados;
  }

  private async lerLoginsLegados(fonte: DataSource): Promise<UsuarioLegado[]> {
    const linhas = (await fonte.query(
      `SELECT l.id, l.login, p.nome_perfil AS perfil FROM cad_login l
         LEFT JOIN cad_login_perfil p ON p.id_perfil = l.id_perfil
        ORDER BY l.id`,
    )) as Array<{ id: number; login: string | null; perfil: string | null }>;
    return linhas.map((l) => ({ id: Number(l.id), login: l.login?.trim() || null, perfil: l.perfil }));
  }

  private async criarUsuarios(
    idEmpresa: number,
    idAutor: number,
    legados: UsuarioLegado[],
  ): Promise<Array<UsuarioCriado & { senhaTemporaria: string }>> {
    const criados: Array<UsuarioCriado & { senhaTemporaria: string }> = [];
    if (!legados.length) return criados;
    const empresa = await this.empresas.findOne({ where: { id: idEmpresa } });
    const plano = empresa?.idPlano ? await this.planos.findOne({ where: { id: empresa.idPlano } }) : null;
    let ativos = await this.usuarios.count({ where: { idEmpresa, status: 'ACTIVE' } });
    for (const legado of legados) {
      const base = (legado.login ?? `USUARIO${legado.id}`).trim().slice(0, 30) || `USUARIO${legado.id}`;
      let login = base;
      for (let tentativa = 1; await this.usuarios.findOne({ where: { login } }); tentativa += 1) {
        login = `${base.slice(0, 26)}.${idEmpresa}${tentativa > 1 ? tentativa : ''}`.slice(0, 40);
      }
      const papel = papelDoPerfil(legado.perfil);
      const status = plano?.maxFuncionarios && ativos >= plano.maxFuncionarios ? 'INACTIVE' : 'ACTIVE';
      const senha = senhaTemporaria();
      const salvo = await this.usuarios.save(
        this.usuarios.create({
          idEmpresa,
          nome: base,
          email: null,
          login,
          senhaHash: await bcrypt.hash(senha, this.config.valores.bcryptRodadas),
          papel,
          idCargo: null,
          status,
          trocarSenha: true,
          idLoginLegado: legado.id,
          criadoPor: idAutor,
        }),
      );
      if (status === 'ACTIVE') ativos += 1;
      await this.auditoria.registrar({
        acao: 'funcionario.importado',
        entidade: 'usuario',
        idEntidade: salvo.id,
        idUsuario: idAutor,
        idEmpresa,
        detalhes: { login, papel, status, idLoginLegado: legado.id },
      });
      criados.push({ id: salvo.id, nome: base, login, papel, status, idLogin: legado.id, senhaTemporaria: senha });
    }
    return criados;
  }

  async limpar(): Promise<void> {
    const limite = new Date(Date.now() - RETENCAO_ANALISE_HORAS * 3600 * 1000);
    const vencidas = await this.importacoes
      .createQueryBuilder('i')
      .addSelect('i.caminho')
      .where('i.status = :status', { status: 'PRONTO' })
      .andWhere('i.criadoEm <= :limite', { limite })
      .getMany();
    for (const importacao of vencidas) {
      await this.apagarArquivo(importacao.caminho);
      await this.importacoes.update(importacao.id, { status: 'EXPIRADO', caminho: null, etapa: 'Expirada sem confirmação' });
    }
    const recebidos = await readdir(this.pastaRecebidos).catch(() => [] as string[]);
    for (const nome of recebidos) {
      const caminho = path.join(this.pastaRecebidos, nome);
      const info = await stat(caminho).catch(() => null);
      if (info && info.mtimeMs < limite.getTime()) await rm(caminho, { force: true }).catch(() => undefined);
    }
  }

  private async hash(caminho: string): Promise<string> {
    const resumo = createHash('sha256');
    await pipeline(createReadStream(caminho), resumo);
    return resumo.digest('hex');
  }

  private async buscarPorId(id: number): Promise<Importacao> {
    const importacao = await this.importacoes.createQueryBuilder('i').addSelect('i.caminho').where('i.id = :id', { id }).getOne();
    if (!importacao) throw new NotFoundException('Importação não encontrada');
    return importacao;
  }

  private async buscar(idEmpresa: number, id: number, comCaminho = false): Promise<Importacao> {
    const consulta = this.importacoes
      .createQueryBuilder('i')
      .where('i.id = :id', { id })
      .andWhere('i.idEmpresa = :idEmpresa', { idEmpresa });
    if (comCaminho) consulta.addSelect('i.caminho');
    const importacao = await consulta.getOne();
    if (!importacao) throw new NotFoundException('Importação não encontrada');
    return importacao;
  }

  private caminhoAbsoluto(relativo: string | null | undefined): string | null {
    if (!relativo) return null;
    const base = this.pastaBase;
    const absoluto = path.resolve(base, relativo);
    if (!absoluto.startsWith(base + path.sep)) return null;
    return absoluto;
  }

  private async apagarArquivo(relativo: string | null | undefined): Promise<void> {
    const absoluto = this.caminhoAbsoluto(relativo);
    if (absoluto) await rm(absoluto, { force: true }).catch(() => undefined);
  }

  private async responder(linhas: Importacao[]): Promise<ImportacaoResposta[]> {
    const ids = [...new Set(linhas.map((l) => l.criadoPor))];
    const usuarios = ids.length ? await this.usuarios.find({ where: { id: In(ids) }, select: { id: true, nome: true } }) : [];
    const nomes = new Map(usuarios.map((u) => [u.id, u.nome]));
    return linhas.map((i) => ({
      id: i.id,
      status: i.status,
      origem: i.origem,
      nomeArquivo: i.nomeArquivo,
      tamanho: i.tamanho === null ? null : Number(i.tamanho),
      progresso: i.progresso,
      etapa: i.etapa,
      erro: i.erro,
      analise: i.analise,
      resultado: i.resultado,
      idBackupOrigem: i.idBackupOrigem,
      idBackupSeguranca: i.idBackupSeguranca,
      criadoEm: comoTexto(i.criadoEm)!,
      confirmadoEm: comoTexto(i.confirmadoEm),
      concluidoEm: comoTexto(i.concluidoEm),
      senhasDisponiveis: this.senhas.has(i.id),
      usuario: nomes.has(i.criadoPor) ? { id: i.criadoPor, nome: nomes.get(i.criadoPor)! } : null,
    }));
  }
}

