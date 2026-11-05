import { randomUUID, createHash } from 'node:crypto';
import { createReadStream, createWriteStream, type ReadStream } from 'node:fs';
import { mkdir, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import {
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, type Repository } from 'typeorm';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { CONEXAO_PLATAFORMA } from '../auth/sessao-usuario.service.js';
import type { UsuarioAutenticado } from '../auth/usuario-autenticado.js';
import { offset, paginado, type Paginado } from '../common/dto/paginacao.dto.js';
import { ConfiguracaoService } from '../config/configuracao.service.js';
import { Backup, PlataformaEmpresa, PlataformaUsuario, type StatusBackup, type TipoBackup } from '../plataforma/entities/index.js';
import { ConexoesEmpresaService } from '../tenancy/conexoes-empresa.service.js';
import { exportarEmpresa, type Progresso } from './exportador-empresa.js';
import {
  FORMATO_PLATAFORMA,
  TABELAS_SEM_DADOS,
  VERSAO_FORMATO_PLATAFORMA,
  contarRegistros,
  exportarBancoSql,
  exportarComMysqldump,
  type BancoParaDump,
  type ResumoBanco,
} from './exportador-plataforma.js';
import { EscritorZip } from './zip.js';

export interface Escopo {
  tipo: TipoBackup;
  idEmpresa: number | null;
}

export interface BackupResposta {
  id: number;
  tipo: TipoBackup;
  status: StatusBackup;
  progresso: number;
  etapa: string | null;
  nomeArquivo: string;
  tamanho: number | null;
  sha256: string | null;
  registros: number | null;
  erro: string | null;
  criadoEm: string;
  concluidoEm: string | null;
  expiraEm: string | null;
  downloads: number;
  disponivel: boolean;
  usuario: { id: number; nome: string } | null;
}

export interface ArquivoParaDownload {
  nome: string;
  tamanho: number;
  stream: ReadStream;
}

const INTERVALO_LIMPEZA_MS = 30 * 60 * 1000;
const INTERVALO_PROGRESSO_MS = 700;
const VERSAO_API = process.env.npm_package_version ?? '0.0.1';

export function slugArquivo(texto: string): string {
  const slug = texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
  return slug || 'empresa';
}

export function dataLocal(data: Date, fuso: string): { dia: string; hora: string } {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: fuso,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(data)
      .map((p) => [p.type, p.value]),
  );
  return { dia: `${partes.year}-${partes.month}-${partes.day}`, hora: `${partes.hour}h${partes.minute}` };
}

function comoData(valor: Date | string | null): Date | null {
  if (valor === null) return null;
  if (valor instanceof Date) return valor;
  return new Date(valor.includes('T') ? valor : valor.replace(' ', 'T'));
}

function comoTexto(valor: Date | string | null): string | null {
  if (valor === null) return null;
  return valor instanceof Date ? valor.toISOString() : valor;
}

function mensagemDeErro(erro: unknown): string {
  const texto = erro instanceof Error ? erro.message : String(erro);
  return texto.replace(/\s+/g, ' ').trim().slice(0, 250) || 'Falha desconhecida';
}

@Injectable()
export class BackupsService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger('Backups');
  private temporizador: NodeJS.Timeout | null = null;
  private readonly emAndamento = new Set<Promise<void>>();

  constructor(
    @InjectRepository(Backup, CONEXAO_PLATAFORMA) private readonly backups: Repository<Backup>,
    @InjectRepository(PlataformaEmpresa, CONEXAO_PLATAFORMA) private readonly empresas: Repository<PlataformaEmpresa>,
    @InjectRepository(PlataformaUsuario, CONEXAO_PLATAFORMA) private readonly usuarios: Repository<PlataformaUsuario>,
    @InjectDataSource(CONEXAO_PLATAFORMA) private readonly plataforma: DataSource,
    private readonly conexoes: ConexoesEmpresaService,
    private readonly config: ConfiguracaoService,
    private readonly auditoria: AuditoriaService,
  ) {}

  get diretorioBase(): string {
    return path.resolve(this.config.valores.backup.diretorio);
  }

  async onApplicationBootstrap(): Promise<void> {
    try {
      const interrompidos = await this.backups
        .createQueryBuilder('b')
        .addSelect('b.caminho')
        .where('b.status = :status', { status: 'PROCESSANDO' })
        .getMany();
      for (const backup of interrompidos) {
        await this.apagarArquivo(backup.caminho);
        await this.backups.update(backup.id, {
          status: 'FALHOU',
          erro: 'Geração interrompida pelo reinício do servidor',
          caminho: null,
          concluidoEm: new Date(),
        });
      }
      await this.limparExpirados();
    } catch (erro) {
      this.logger.warn(`Não foi possível revisar os backups pendentes: ${mensagemDeErro(erro)}`);
    }
    this.temporizador = setInterval(() => {
      void this.limparExpirados().catch((erro) => this.logger.warn(`Falha na limpeza de backups: ${mensagemDeErro(erro)}`));
    }, INTERVALO_LIMPEZA_MS);
    this.temporizador.unref();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.temporizador) clearInterval(this.temporizador);
    await Promise.allSettled([...this.emAndamento]);
  }

  escopoDaEmpresa(usuario: UsuarioAutenticado): Escopo {
    if (!usuario.idEmpresa || !usuario.empresa) throw new ForbiddenException('Esta área é exclusiva das empresas');
    return { tipo: 'EMPRESA', idEmpresa: usuario.idEmpresa };
  }

  readonly escopoPlataforma: Escopo = { tipo: 'PLATAFORMA', idEmpresa: null };

  async gerarDaEmpresa(usuario: UsuarioAutenticado): Promise<BackupResposta> {
    const escopo = this.escopoDaEmpresa(usuario);
    const empresa = usuario.empresa!;
    const emCurso = await this.emProcessamento(escopo);
    if (emCurso) return this.obter(escopo, emCurso.id);

    const agora = new Date();
    const { dia, hora } = dataLocal(agora, this.config.fusoHorario);
    const nome = `atrativa-shore-backup-${slugArquivo(empresa.nome)}-${dia}.zip`;
    const backup = await this.criarRegistro(escopo, usuario.id, nome, `empresa-${escopo.idEmpresa}`);
    this.agendar(backup, async (zip, progresso) => {
      const fonte = await this.conexoes.obter(empresa.banco);
      const resultado = await exportarEmpresa(
        fonte,
        this.plataforma,
        zip,
        {
          idEmpresa: escopo.idEmpresa!,
          nomeEmpresa: empresa.nome,
          geradoPor: { id: usuario.id, nome: usuario.nome },
          geradoEm: agora,
          versaoApi: VERSAO_API,
        },
        progresso,
      );
      return { registros: resultado.registros, detalhes: { hora, tabelas: resultado.arquivos.length } };
    });
    return this.obter(escopo, backup.id);
  }

  async gerarDaPlataforma(usuario: UsuarioAutenticado): Promise<BackupResposta> {
    const escopo = this.escopoPlataforma;
    const emCurso = await this.emProcessamento(escopo);
    if (emCurso) return this.obter(escopo, emCurso.id);

    const agora = new Date();
    const { dia, hora } = dataLocal(agora, this.config.fusoHorario);
    const nome = `atrativa-shore-backup-plataforma-${dia}-${hora}.zip`;
    const backup = await this.criarRegistro(escopo, usuario.id, nome, 'plataforma');
    this.agendar(backup, async (zip, progresso) => {
      const valores = this.config.valores;
      const empresas = await this.empresas.find({ where: { bancoProvisionado: true }, order: { id: 'ASC' } });
      const central = valores.plataforma.banco;
      const vistos = new Set<string>([central]);
      const alvos: BancoParaDump[] = [{ banco: central, fonte: this.plataforma, idEmpresa: null, nomeEmpresa: null }];
      for (const empresa of empresas) {
        if (vistos.has(empresa.banco)) continue;
        vistos.add(empresa.banco);
        alvos.push({ banco: empresa.banco, fonte: await this.conexoes.obter(empresa.banco), idEmpresa: empresa.id, nomeEmpresa: empresa.nome });
      }

      const bancos: ResumoBanco[] = [];
      let ferramenta: string;
      if (valores.backup.mysqldump) {
        ferramenta = 'mysqldump';
        await progresso(5, 'Executando mysqldump');
        const { arquivo } = await exportarComMysqldump(
          valores.backup.mysqldump,
          { host: valores.banco.host, porta: valores.banco.porta, usuario: valores.banco.usuario, senha: valores.banco.senha },
          alvos.map((a) => a.banco),
          TABELAS_SEM_DADOS.map((tabela) => `${central}.${tabela}`),
          zip,
        );
        for (const alvo of alvos) {
          bancos.push({ banco: alvo.banco, arquivo, idEmpresa: alvo.idEmpresa, tabelas: 0, registros: 0 });
        }
      } else {
        ferramenta = 'exportador interno (SHOW CREATE TABLE + INSERT, snapshot consistente por banco)';
        const estimativas = await Promise.all(alvos.map((a) => contarRegistros(a.fonte).catch(() => 0)));
        const total = Math.max(1, estimativas.reduce((a, b) => a + b, 0));
        let feitos = 0;
        for (const alvo of alvos) {
          const resumo = await exportarBancoSql(
            alvo,
            zip,
            (linhas) => {
              feitos += linhas;
            },
            (tabela) => progresso(Math.min(95, Math.round((feitos / total) * 95)), `Exportando ${alvo.banco}.${tabela}`),
          );
          bancos.push(resumo);
        }
      }

      await progresso(97, 'Gravando metadados');
      const registros = bancos.reduce((a, b) => a + b.registros, 0);
      await zip.adicionar(
        'metadados.json',
        `${JSON.stringify(
          {
            formato: FORMATO_PLATAFORMA,
            versaoFormato: VERSAO_FORMATO_PLATAFORMA,
            versaoApi: VERSAO_API,
            geradoEm: agora.toISOString(),
            geradoPor: { id: usuario.id, nome: usuario.nome },
            ferramenta,
            bancoCentral: central,
            bancos: bancos.map((b) => ({
              ...b,
              empresa: alvos.find((a) => a.banco === b.banco)?.nomeEmpresa ?? null,
            })),
            registros,
            naoIncluido: TABELAS_SEM_DADOS.map((tabela) => ({ tabela: `${central}.${tabela}`, motivo: 'sessões de acesso' })),
          },
          null,
          2,
        )}\n`,
      );
      await zip.adicionar(
        'LEIA-ME.txt',
        [
          `Backup completo da plataforma Atrativa Shore gerado em ${agora.toISOString()}.`,
          '',
          'ARQUIVO SENSÍVEL: contém os dados de todas as empresas, incluindo hashes de senha e as senhas do sistema legado.',
          'Guarde em local protegido e não compartilhe.',
          '',
          'sql/       um script SQL por banco (ou um único script do mysqldump), com estrutura e dados',
          'metadados.json  versão do formato, data, responsável e lista dos bancos exportados',
          '',
          'Os scripts não apagam tabelas existentes: restaure em um servidor MySQL sem esses bancos.',
          '',
        ].join('\n'),
      );
      return { registros, detalhes: { bancos: bancos.length, ferramenta: valores.backup.mysqldump ? 'mysqldump' : 'interno' } };
    });
    return this.obter(escopo, backup.id);
  }

  async listar(escopo: Escopo, paginacao: { page: number; limit: number }): Promise<Paginado<BackupResposta>> {
    const [linhas, total] = await this.backups.findAndCount({
      where: { tipo: escopo.tipo, ...(escopo.tipo === 'EMPRESA' ? { idEmpresa: escopo.idEmpresa! } : {}) },
      order: { id: 'DESC' },
      skip: offset(paginacao),
      take: paginacao.limit,
    });
    return paginado(await this.responder(linhas), total, paginacao.page, paginacao.limit);
  }

  async obter(escopo: Escopo, id: number): Promise<BackupResposta> {
    const [resposta] = await this.responder([await this.buscar(escopo, id)]);
    return resposta;
  }

  async abrirDownload(escopo: Escopo, id: number, usuario: UsuarioAutenticado): Promise<ArquivoParaDownload> {
    const backup = await this.buscar(escopo, id, true);
    if (backup.status === 'PROCESSANDO') throw new ConflictException('O backup ainda está sendo gerado');
    if (backup.status === 'FALHOU') throw new GoneException('A geração deste backup falhou. Gere um novo backup.');
    if (backup.status === 'EXPIRADO' || !this.disponivel(backup)) {
      throw new GoneException('Este backup expirou e o arquivo foi removido. Gere um novo backup.');
    }
    const caminho = this.caminhoAbsoluto(backup.caminho);
    const informacoes = caminho ? await stat(caminho).catch(() => null) : null;
    if (!caminho || !informacoes?.isFile()) {
      await this.backups.update(backup.id, { status: 'EXPIRADO', caminho: null });
      throw new GoneException('O arquivo deste backup não está mais disponível. Gere um novo backup.');
    }
    await this.backups.increment({ id: backup.id }, 'downloads', 1);
    await this.backups.update(backup.id, { ultimoDownloadEm: new Date() });
    await this.auditoria.registrar({
      acao: 'backup.baixado',
      entidade: 'backup',
      idEntidade: backup.id,
      idUsuario: usuario.id,
      idEmpresa: escopo.idEmpresa,
      detalhes: { tipo: backup.tipo, arquivo: backup.nomeArquivo, tamanho: informacoes.size },
    });
    return { nome: backup.nomeArquivo, tamanho: informacoes.size, stream: createReadStream(caminho) };
  }

  async limparExpirados(): Promise<number> {
    const vencidos = await this.backups
      .createQueryBuilder('b')
      .addSelect('b.caminho')
      .where('b.status = :status', { status: 'CONCLUIDO' })
      .andWhere('b.expiraEm <= :agora', { agora: new Date() })
      .getMany();
    for (const backup of vencidos) {
      await this.apagarArquivo(backup.caminho);
      await this.backups.update(backup.id, { status: 'EXPIRADO', caminho: null });
    }
    return vencidos.length;
  }

  aguardarGeracoes(): Promise<unknown> {
    return Promise.allSettled([...this.emAndamento]);
  }

  private async emProcessamento(escopo: Escopo): Promise<Backup | null> {
    return this.backups.findOne({
      where: { tipo: escopo.tipo, status: 'PROCESSANDO', ...(escopo.tipo === 'EMPRESA' ? { idEmpresa: escopo.idEmpresa! } : {}) },
      order: { id: 'DESC' },
    });
  }

  private async criarRegistro(escopo: Escopo, idUsuario: number, nome: string, pasta: string): Promise<Backup> {
    const relativo = path.posix.join(pasta, `${randomUUID()}.zip`);
    return this.backups.save(
      this.backups.create({
        tipo: escopo.tipo,
        idEmpresa: escopo.idEmpresa,
        status: 'PROCESSANDO',
        progresso: 0,
        etapa: 'Na fila',
        nomeArquivo: nome,
        caminho: relativo,
        criadoPor: idUsuario,
      }),
    );
  }

  private agendar(
    backup: Backup,
    exportar: (zip: EscritorZip, progresso: Progresso) => Promise<{ registros: number; detalhes: Record<string, unknown> }>,
  ): void {
    const tarefa = this.executar(backup, exportar).finally(() => this.emAndamento.delete(tarefa));
    this.emAndamento.add(tarefa);
  }

  private async executar(
    backup: Backup,
    exportar: (zip: EscritorZip, progresso: Progresso) => Promise<{ registros: number; detalhes: Record<string, unknown> }>,
  ): Promise<void> {
    const final = this.caminhoAbsoluto(backup.caminho)!;
    const parcial = `${final}.parcial`;
    let ultimo = 0;
    let ultimoPercentual = -1;
    const progresso: Progresso = async (percentual, etapa) => {
      const agora = Date.now();
      if (percentual === ultimoPercentual || agora - ultimo < INTERVALO_PROGRESSO_MS) return;
      ultimo = agora;
      ultimoPercentual = percentual;
      await this.backups.update(backup.id, { progresso: percentual, etapa: etapa.slice(0, 120) }).catch(() => undefined);
    };
    try {
      await mkdir(path.dirname(final), { recursive: true, mode: 0o700 });
      const saida = createWriteStream(parcial, { mode: 0o600 });
      const erroSaida = new Promise<never>((_, rejeitar) => saida.once('error', rejeitar));
      erroSaida.catch(() => undefined);
      const zip = new EscritorZip(saida);
      await progresso(1, 'Preparando');
      const { registros, detalhes } = await Promise.race([
        (async () => {
          const resultado = await exportar(zip, progresso);
          await zip.finalizar();
          return resultado;
        })(),
        erroSaida,
      ]);
      await rename(parcial, final);
      const { size } = await stat(final);
      const sha256 = await this.hash(final);
      const concluidoEm = new Date();
      const expiraEm = new Date(concluidoEm.getTime() + this.config.valores.backup.retencaoHoras * 3600 * 1000);
      await this.backups.update(backup.id, {
        status: 'CONCLUIDO',
        progresso: 100,
        etapa: 'Concluído',
        tamanho: String(size),
        sha256,
        registros,
        concluidoEm,
        expiraEm,
      });
      await this.auditoria.registrar({
        acao: 'backup.gerado',
        entidade: 'backup',
        idEntidade: backup.id,
        idUsuario: backup.criadoPor,
        idEmpresa: backup.idEmpresa,
        detalhes: { tipo: backup.tipo, arquivo: backup.nomeArquivo, tamanho: size, registros, ...detalhes },
      });
    } catch (erro) {
      const mensagem = mensagemDeErro(erro);
      this.logger.error(`Backup ${backup.id} falhou: ${mensagem}`);
      await rm(parcial, { force: true }).catch(() => undefined);
      await rm(final, { force: true }).catch(() => undefined);
      await this.backups
        .update(backup.id, { status: 'FALHOU', etapa: 'Falhou', erro: mensagem, caminho: null, concluidoEm: new Date() })
        .catch(() => undefined);
      await this.auditoria.registrar({
        acao: 'backup.falhou',
        entidade: 'backup',
        idEntidade: backup.id,
        idUsuario: backup.criadoPor,
        idEmpresa: backup.idEmpresa,
        detalhes: { tipo: backup.tipo, erro: mensagem },
      });
    }
  }

  private async hash(caminho: string): Promise<string> {
    const resumo = createHash('sha256');
    await pipeline(createReadStream(caminho), resumo);
    return resumo.digest('hex');
  }

  private async buscar(escopo: Escopo, id: number, comCaminho = false): Promise<Backup> {
    const consulta = this.backups
      .createQueryBuilder('b')
      .where('b.id = :id', { id })
      .andWhere('b.tipo = :tipo', { tipo: escopo.tipo });
    if (escopo.tipo === 'EMPRESA') consulta.andWhere('b.idEmpresa = :idEmpresa', { idEmpresa: escopo.idEmpresa });
    if (comCaminho) consulta.addSelect('b.caminho');
    const backup = await consulta.getOne();
    if (!backup) throw new NotFoundException('Backup não encontrado');
    return backup;
  }

  private disponivel(backup: Backup): boolean {
    if (backup.status !== 'CONCLUIDO') return false;
    const expira = comoData(backup.expiraEm);
    return !expira || expira.getTime() > Date.now();
  }

  private caminhoAbsoluto(relativo: string | null | undefined): string | null {
    if (!relativo) return null;
    const base = this.diretorioBase;
    const absoluto = path.resolve(base, relativo);
    if (absoluto !== base && !absoluto.startsWith(base + path.sep)) return null;
    return absoluto;
  }

  private async apagarArquivo(relativo: string | null | undefined): Promise<void> {
    const absoluto = this.caminhoAbsoluto(relativo);
    if (!absoluto) return;
    await rm(absoluto, { force: true }).catch(() => undefined);
    await rm(`${absoluto}.parcial`, { force: true }).catch(() => undefined);
  }

  private async responder(linhas: Backup[]): Promise<BackupResposta[]> {
    const ids = [...new Set(linhas.map((l) => l.criadoPor))];
    const usuarios = ids.length ? await this.usuarios.find({ where: { id: In(ids) }, select: { id: true, nome: true } }) : [];
    const nomes = new Map(usuarios.map((u) => [u.id, u.nome]));
    return linhas.map((b) => ({
      id: b.id,
      tipo: b.tipo,
      status: b.status === 'CONCLUIDO' && !this.disponivel(b) ? 'EXPIRADO' : b.status,
      progresso: b.progresso,
      etapa: b.etapa,
      nomeArquivo: b.nomeArquivo,
      tamanho: b.tamanho === null ? null : Number(b.tamanho),
      sha256: b.sha256,
      registros: b.registros,
      erro: b.erro,
      criadoEm: comoTexto(b.criadoEm)!,
      concluidoEm: comoTexto(b.concluidoEm),
      expiraEm: comoTexto(b.expiraEm),
      downloads: b.downloads,
      disponivel: this.disponivel(b),
      usuario: nomes.has(b.criadoPor) ? { id: b.criadoPor, nome: nomes.get(b.criadoPor)! } : null,
    }));
  }
}
