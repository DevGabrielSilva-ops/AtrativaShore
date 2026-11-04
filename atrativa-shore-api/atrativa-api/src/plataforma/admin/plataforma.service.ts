import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import bcrypt from 'bcrypt';
import { DataSource, In, Not, type Repository } from 'typeorm';
import { gerarCodigoAtivacao, prefixoDoCodigo, sha256Normalizado, situacaoDoCodigo } from '../../ativacao/codigos.js';
import { statusEfetivo } from '../../acesso/permissoes.js';
import { AuditoriaService } from '../../auditoria/auditoria.service.js';
import { AuthService } from '../../auth/auth.service.js';
import { CONEXAO_PLATAFORMA, SessaoUsuarioService } from '../../auth/sessao-usuario.service.js';
import type { UsuarioAutenticado } from '../../auth/usuario-autenticado.js';
import { offset, paginado, type Paginado } from '../../common/dto/paginacao.dto.js';
import { senhaTemporaria } from '../../common/utils/segredos.js';
import { ConfiguracaoService } from '../../config/configuracao.service.js';
import { FuncionariosService } from '../../funcionarios/funcionarios.service.js';
import { ProvisionamentoService } from '../../tenancy/provisionamento.service.js';
import { Ativacao, CodigoAtivacao, Plano, PlataformaEmpresa, PlataformaUsuario } from '../entities/index.js';
import type { StatusEmpresa } from '../entities/papeis.js';
import type {
  AdministradorDto,
  AlterarStatusEmpresaDto,
  AtualizarEmpresaPlataformaDto,
  EmpresaPlataformaDto,
  GerarCodigoDto,
  ListarCodigosDto,
  ListarEmpresasDto,
  PlanoDto,
} from './dto/plataforma.dto.js';

export interface EmpresaResumo {
  id: number;
  nome: string;
  cnpj: string | null;
  email: string | null;
  telefone: string | null;
  cidade: string | null;
  uf: string | null;
  status: StatusEmpresa;
  motivoStatus: string | null;
  plano: { id: number; nome: string } | null;
  assinaturaAte: string | null;
  bancoProvisionado: boolean;
  usuarios: number;
  usuariosAtivos: number;
  criadaEm: Date;
  ativadaEm: Date | null;
  suspensaEm: Date | null;
}

@Injectable()
export class PlataformaService {
  constructor(
    @InjectDataSource(CONEXAO_PLATAFORMA) private readonly fonte: DataSource,
    @InjectRepository(PlataformaEmpresa, CONEXAO_PLATAFORMA) private readonly empresas: Repository<PlataformaEmpresa>,
    @InjectRepository(PlataformaUsuario, CONEXAO_PLATAFORMA) private readonly usuarios: Repository<PlataformaUsuario>,
    @InjectRepository(Plano, CONEXAO_PLATAFORMA) private readonly planos: Repository<Plano>,
    @InjectRepository(CodigoAtivacao, CONEXAO_PLATAFORMA) private readonly codigos: Repository<CodigoAtivacao>,
    @InjectRepository(Ativacao, CONEXAO_PLATAFORMA) private readonly ativacoes: Repository<Ativacao>,
    private readonly sessoes: SessaoUsuarioService,
    private readonly funcionarios: FuncionariosService,
    private readonly provisionamento: ProvisionamentoService,
    private readonly auth: AuthService,
    private readonly auditoria: AuditoriaService,
    private readonly config: ConfiguracaoService,
  ) {}

  async indicadores() {
    const hoje = this.sessoes.hoje();
    const [empresas, usuarios, ativacoes, codigosAtivos, recentes] = await Promise.all([
      this.empresas.find({ select: { id: true, status: true, assinaturaAte: true } }),
      this.fonte.query(
        "SELECT papel, status, COUNT(*) AS total FROM plataforma_usuarios WHERE papel <> 'SUPER_ADMIN' GROUP BY papel, status",
      ) as Promise<Array<{ papel: string; status: string; total: string }>>,
      this.ativacoes.count(),
      this.fonte.query(
        'SELECT COUNT(*) AS total FROM plataforma_codigos_ativacao WHERE revogado_em IS NULL AND usos < max_usos AND expira_em > NOW()',
      ) as Promise<Array<{ total: string }>>,
      this.listarEmpresas({ page: 1, limit: 5 }),
    ]);
    const porStatus: Record<StatusEmpresa, number> = { PENDING: 0, ACTIVE: 0, SUSPENDED: 0, EXPIRED: 0 };
    for (const empresa of empresas) porStatus[statusEfetivo(empresa.status, empresa.assinaturaAte, hoje)] += 1;
    const porPapel: Record<string, number> = {};
    let ativos = 0;
    for (const linha of usuarios) {
      porPapel[linha.papel] = (porPapel[linha.papel] ?? 0) + Number(linha.total);
      if (linha.status === 'ACTIVE') ativos += Number(linha.total);
    }
    return {
      empresas: { total: empresas.length, ...porStatus },
      usuarios: { total: Object.values(porPapel).reduce((a, b) => a + b, 0), ativos, porPapel },
      ativacoes,
      codigosAtivos: Number(codigosAtivos[0]?.total ?? 0),
      empresasRecentes: recentes.data,
    };
  }

  async listarEmpresas(filtro: ListarEmpresasDto): Promise<Paginado<EmpresaResumo>> {
    const consulta = this.empresas.createQueryBuilder('e').orderBy('e.criadaEm', 'DESC').addOrderBy('e.id', 'DESC');
    if (filtro.busca) {
      consulta.andWhere('(e.nome LIKE :busca OR e.cnpj LIKE :busca OR e.email LIKE :busca)', { busca: `%${filtro.busca}%` });
    }
    const hoje = this.sessoes.hoje();
    if (filtro.status === 'EXPIRED') {
      consulta.andWhere("(e.status = 'EXPIRED' OR (e.status = 'ACTIVE' AND e.assinaturaAte < :hoje))", { hoje });
    } else if (filtro.status === 'ACTIVE') {
      consulta.andWhere("e.status = 'ACTIVE' AND (e.assinaturaAte IS NULL OR e.assinaturaAte >= :hoje)", { hoje });
    } else if (filtro.status) {
      consulta.andWhere('e.status = :status', { status: filtro.status });
    }
    const [linhas, total] = await consulta.skip(offset(filtro)).take(filtro.limit).getManyAndCount();
    return paginado(await this.resumir(linhas), total, filtro.page, filtro.limit);
  }

  async criarEmpresa(autor: UsuarioAutenticado, dto: EmpresaPlataformaDto): Promise<EmpresaResumo> {
    if (dto.idPlano) await this.planoAtivo(dto.idPlano);
    const empresa = await this.fonte.transaction(async (manager) => {
      const repositorio = manager.getRepository(PlataformaEmpresa);
      const salva = await repositorio.save(
        repositorio.create({
          nome: dto.nome,
          cnpj: dto.cnpj ?? null,
          email: dto.email?.toLowerCase() ?? null,
          telefone: dto.telefone ?? null,
          cidade: dto.cidade ?? null,
          uf: dto.uf?.toUpperCase() ?? null,
          idPlano: dto.idPlano ?? (await this.planoPadrao()),
          assinaturaAte: dto.assinaturaAte ?? null,
          status: 'PENDING',
          banco: `pendente_${Date.now()}`,
          bancoProvisionado: false,
          criadaPor: autor.id,
        }),
      );
      await repositorio.update({ id: salva.id }, { banco: this.provisionamento.nomeDoBanco(salva.id) });
      return salva;
    });
    await this.auditoria.registrar({ acao: 'plataforma.empresa_criada', entidade: 'empresa', idEntidade: empresa.id, detalhes: dto });
    return this.obterResumo(empresa.id);
  }

  async obterEmpresa(id: number) {
    const resumo = await this.obterResumo(id);
    const [usuarios, ativacoes, codigos] = await Promise.all([
      this.usuarios.find({ where: { idEmpresa: id }, order: { papel: 'ASC', nome: 'ASC' } }),
      this.ativacoes.find({ where: { idEmpresa: id }, order: { dataHora: 'DESC' }, take: 20 }),
      this.codigos.find({ where: { idEmpresa: id }, order: { criadoEm: 'DESC' }, take: 20 }),
    ]);
    const nomes = new Map(usuarios.map((u) => [u.id, u.nome]));
    return {
      ...resumo,
      administradores: usuarios
        .filter((u) => u.papel === 'COMPANY_ADMIN')
        .map((u) => ({ id: u.id, nome: u.nome, email: u.email, login: u.login, status: u.status, ultimoLoginEm: u.ultimoLoginEm })),
      funcionariosPorPapel: usuarios.reduce<Record<string, number>>((acc, u) => ({ ...acc, [u.papel]: (acc[u.papel] ?? 0) + 1 }), {}),
      ativacoes: ativacoes.map((a) => ({ id: a.id, dataHora: a.dataHora, usuario: nomes.get(a.idUsuario) ?? `#${a.idUsuario}` })),
      codigos: codigos.map((c) => this.mapearCodigo(c)),
    };
  }

  async atualizarEmpresa(id: number, dto: AtualizarEmpresaPlataformaDto): Promise<EmpresaResumo> {
    await this.buscarEmpresa(id);
    if (dto.idPlano) await this.planoAtivo(dto.idPlano);
    await this.empresas.update(
      { id },
      {
        ...(dto.nome !== undefined ? { nome: dto.nome } : {}),
        ...(dto.idPlano !== undefined ? { idPlano: dto.idPlano } : {}),
        ...(dto.assinaturaAte !== undefined ? { assinaturaAte: dto.assinaturaAte } : {}),
      },
    );
    await this.auditoria.registrar({ acao: 'plataforma.empresa_atualizada', entidade: 'empresa', idEntidade: id, detalhes: dto });
    return this.obterResumo(id);
  }

  async alterarStatus(id: number, dto: AlterarStatusEmpresaDto): Promise<EmpresaResumo> {
    const empresa = await this.buscarEmpresa(id);
    const hoje = this.sessoes.hoje();
    if (dto.status === 'ACTIVE') {
      if (!empresa.bancoProvisionado) {
        throw new ConflictException('A empresa ainda não foi ativada pelo responsável. Gere um código de ativação para ela.');
      }
      const assinaturaAte = dto.assinaturaAte ?? empresa.assinaturaAte;
      if (assinaturaAte && assinaturaAte < hoje) {
        throw new BadRequestException('A assinatura está vencida. Informe a nova data de fim (assinaturaAte) para reativar.');
      }
      await this.empresas.update(
        { id },
        { status: 'ACTIVE', motivoStatus: dto.motivo ?? null, suspensaEm: null, assinaturaAte, ativadaEm: empresa.ativadaEm ?? new Date() },
      );
    } else {
      await this.empresas.update({ id }, { status: 'SUSPENDED', motivoStatus: dto.motivo ?? null, suspensaEm: new Date() });
      const usuarios = await this.usuarios.find({ where: { idEmpresa: id }, select: { id: true } });
      for (const usuario of usuarios) await this.auth.revogarTodas(usuario.id);
    }
    await this.auditoria.registrar({
      acao: dto.status === 'ACTIVE' ? 'plataforma.empresa_ativada' : 'plataforma.empresa_suspensa',
      entidade: 'empresa',
      idEntidade: id,
      idEmpresa: id,
      detalhes: { motivo: dto.motivo ?? null, statusAnterior: empresa.status },
    });
    return this.obterResumo(id);
  }

  async senhaTemporariaUsuario(idEmpresa: number, idUsuario: number) {
    const usuario = await this.usuarios.findOne({ where: { id: idUsuario, idEmpresa } });
    if (!usuario) throw new NotFoundException('Usuário não encontrado nesta empresa');
    return this.funcionarios.gerarSenhaTemporaria(usuario);
  }

  listarPlanos() {
    return this.planos.find({ order: { nome: 'ASC' } });
  }

  async criarPlano(dto: PlanoDto) {
    if (await this.planos.exists({ where: { nome: dto.nome } })) throw new ConflictException('Já existe um plano com este nome');
    const plano = await this.planos.save(
      this.planos.create({ nome: dto.nome, descricao: dto.descricao ?? null, maxFuncionarios: dto.maxFuncionarios ?? null, ativo: dto.ativo ?? true }),
    );
    await this.auditoria.registrar({ acao: 'plataforma.plano_criado', entidade: 'plano', idEntidade: plano.id, detalhes: dto });
    return plano;
  }

  async atualizarPlano(id: number, dto: PlanoDto) {
    const plano = await this.planos.findOne({ where: { id } });
    if (!plano) throw new NotFoundException('Plano não encontrado');
    if (dto.nome !== plano.nome && (await this.planos.exists({ where: { nome: dto.nome, id: Not(id) } }))) {
      throw new ConflictException('Já existe um plano com este nome');
    }
    await this.planos.update(
      { id },
      { nome: dto.nome, descricao: dto.descricao ?? null, maxFuncionarios: dto.maxFuncionarios ?? null, ativo: dto.ativo ?? plano.ativo },
    );
    await this.auditoria.registrar({ acao: 'plataforma.plano_atualizado', entidade: 'plano', idEntidade: id, detalhes: dto });
    return this.planos.findOneByOrFail({ id });
  }

  async listarCodigos(filtro: ListarCodigosDto) {
    const consulta = this.codigos.createQueryBuilder('c').orderBy('c.criadoEm', 'DESC').addOrderBy('c.id', 'DESC');
    if (filtro.idEmpresa) consulta.andWhere('c.idEmpresa = :idEmpresa', { idEmpresa: filtro.idEmpresa });
    if (filtro.situacao === 'REVOGADO') consulta.andWhere('c.revogadoEm IS NOT NULL');
    if (filtro.situacao === 'USADO') consulta.andWhere('c.revogadoEm IS NULL AND c.usos >= c.maxUsos');
    if (filtro.situacao === 'EXPIRADO') consulta.andWhere('c.revogadoEm IS NULL AND c.usos < c.maxUsos AND c.expiraEm <= NOW()');
    if (filtro.situacao === 'ATIVO') consulta.andWhere('c.revogadoEm IS NULL AND c.usos < c.maxUsos AND c.expiraEm > NOW()');
    const [linhas, total] = await consulta.skip(offset(filtro)).take(filtro.limit).getManyAndCount();
    const ids = [...new Set(linhas.map((c) => c.idEmpresa).filter((id): id is number => id !== null))];
    const nomes = new Map((ids.length ? await this.empresas.findBy({ id: In(ids) }) : []).map((e) => [e.id, e.nome]));
    return paginado(
      linhas.map((c) => ({ ...this.mapearCodigo(c), empresa: c.idEmpresa ? { id: c.idEmpresa, nome: nomes.get(c.idEmpresa) ?? null } : null })),
      total,
      filtro.page,
      filtro.limit,
    );
  }

  async gerarCodigo(autor: UsuarioAutenticado, dto: GerarCodigoDto) {
    if (dto.tipo === 'EMPRESA_EXISTENTE') {
      if (!dto.idEmpresa) throw new BadRequestException('Escolha a empresa do código');
      const empresa = await this.buscarEmpresa(dto.idEmpresa);
      if (empresa.status === 'SUSPENDED') throw new ConflictException('Reative a empresa antes de gerar um código para ela');
    } else if (dto.idEmpresa) {
      throw new BadRequestException('Código de nova empresa não pode ter empresa vinculada');
    }
    const { codigo, normalizado } = gerarCodigoAtivacao();
    const dias = dto.validadeDias ?? this.config.valores.plataforma.ativacaoValidadeDias;
    const salvo = await this.codigos.save(
      this.codigos.create({
        hash: sha256Normalizado(normalizado),
        prefixo: prefixoDoCodigo(normalizado),
        tipo: dto.tipo,
        idEmpresa: dto.idEmpresa ?? null,
        emailDestinatario: dto.emailDestinatario?.toLowerCase() ?? null,
        observacao: dto.observacao ?? null,
        maxUsos: dto.maxUsos ?? 1,
        usos: 0,
        expiraEm: new Date(Date.now() + dias * 24 * 3600 * 1000),
        criadoPor: autor.id,
      }),
    );
    await this.auditoria.registrar({
      acao: 'plataforma.codigo_gerado',
      entidade: 'codigo_ativacao',
      idEntidade: salvo.id,
      idEmpresa: salvo.idEmpresa,
      detalhes: { tipo: salvo.tipo, prefixo: salvo.prefixo, validadeDias: dias, maxUsos: salvo.maxUsos },
    });
    return { codigo, ...this.mapearCodigo(salvo) };
  }

  async revogarCodigo(id: number) {
    const codigo = await this.codigos.findOne({ where: { id } });
    if (!codigo) throw new NotFoundException('Código não encontrado');
    if (!codigo.revogadoEm) {
      await this.codigos.update({ id }, { revogadoEm: new Date() });
      await this.auditoria.registrar({
        acao: 'plataforma.codigo_revogado',
        entidade: 'codigo_ativacao',
        idEntidade: id,
        idEmpresa: codigo.idEmpresa,
        detalhes: { prefixo: codigo.prefixo },
      });
    }
    return this.mapearCodigo(await this.codigos.findOneByOrFail({ id }));
  }

  async listarAdministradores() {
    const lista = await this.usuarios.find({ where: { papel: 'SUPER_ADMIN' }, order: { nome: 'ASC' } });
    return lista.map((u) => ({
      id: u.id,
      nome: u.nome,
      email: u.email,
      status: u.status,
      trocarSenha: u.trocarSenha,
      ultimoLoginEm: u.ultimoLoginEm,
      criadoEm: u.criadoEm,
    }));
  }

  async criarAdministrador(autor: UsuarioAutenticado, dto: AdministradorDto) {
    const email = dto.email.toLowerCase();
    await this.funcionarios.garantirIdentificadoresLivres(email, null);
    const senha = senhaTemporaria();
    const salvo = await this.usuarios.save(
      this.usuarios.create({
        idEmpresa: null,
        nome: dto.nome,
        email,
        senhaHash: await bcrypt.hash(senha, this.config.valores.bcryptRodadas),
        papel: 'SUPER_ADMIN',
        status: 'ACTIVE',
        trocarSenha: true,
        criadoPor: autor.id,
      }),
    );
    await this.auditoria.registrar({ acao: 'plataforma.admin_criado', entidade: 'usuario', idEntidade: salvo.id, detalhes: { nome: dto.nome } });
    return { id: salvo.id, nome: salvo.nome, email: salvo.email, senhaTemporaria: senha };
  }

  async alterarStatusAdministrador(autor: UsuarioAutenticado, id: number, status: 'ACTIVE' | 'INACTIVE') {
    if (id === autor.id) throw new ForbiddenException('Você não pode alterar o próprio acesso');
    const usuario = await this.usuarios.findOne({ where: { id, papel: 'SUPER_ADMIN' } });
    if (!usuario) throw new NotFoundException('Administrador não encontrado');
    if (status === 'INACTIVE') {
      const outros = await this.usuarios.count({ where: { papel: 'SUPER_ADMIN', status: 'ACTIVE', id: Not(id) } });
      if (outros === 0) throw new ConflictException('A plataforma precisa de pelo menos um superadministrador ativo');
    }
    await this.usuarios.update({ id }, { status, versaoToken: usuario.versaoToken + 1 });
    await this.auth.revogarTodas(id);
    await this.auditoria.registrar({
      acao: status === 'ACTIVE' ? 'plataforma.admin_ativado' : 'plataforma.admin_desativado',
      entidade: 'usuario',
      idEntidade: id,
    });
    return (await this.listarAdministradores()).find((a) => a.id === id);
  }

  async senhaTemporariaAdministrador(autor: UsuarioAutenticado, id: number) {
    if (id === autor.id) throw new BadRequestException('Use a troca de senha do seu perfil');
    const usuario = await this.usuarios.findOne({ where: { id, papel: 'SUPER_ADMIN' } });
    if (!usuario) throw new NotFoundException('Administrador não encontrado');
    return this.funcionarios.gerarSenhaTemporaria(usuario);
  }

  private mapearCodigo(codigo: CodigoAtivacao) {
    return {
      id: codigo.id,
      prefixo: codigo.prefixo,
      tipo: codigo.tipo,
      idEmpresa: codigo.idEmpresa,
      emailDestinatario: codigo.emailDestinatario,
      observacao: codigo.observacao,
      maxUsos: codigo.maxUsos,
      usos: codigo.usos,
      expiraEm: codigo.expiraEm,
      revogadoEm: codigo.revogadoEm,
      ultimoUsoEm: codigo.ultimoUsoEm,
      criadoEm: codigo.criadoEm,
      situacao: situacaoDoCodigo(codigo),
    };
  }

  private async obterResumo(id: number): Promise<EmpresaResumo> {
    const [resumo] = await this.resumir([await this.buscarEmpresa(id)]);
    return resumo;
  }

  private async resumir(empresas: PlataformaEmpresa[]): Promise<EmpresaResumo[]> {
    if (empresas.length === 0) return [];
    const ids = empresas.map((e) => e.id);
    const [contagens, planos] = await Promise.all([
      this.fonte.query(
        `SELECT id_empresa, COUNT(*) AS total, SUM(status = 'ACTIVE') AS ativos
           FROM plataforma_usuarios WHERE id_empresa IN (?) GROUP BY id_empresa`,
        [ids],
      ) as Promise<Array<{ id_empresa: number; total: string; ativos: string }>>,
      this.planos.find(),
    ]);
    const porEmpresa = new Map(contagens.map((c) => [Number(c.id_empresa), c]));
    const nomesPlano = new Map(planos.map((p) => [p.id, p.nome]));
    const hoje = this.sessoes.hoje();
    return empresas.map((e) => ({
      id: e.id,
      nome: e.nome,
      cnpj: e.cnpj,
      email: e.email,
      telefone: e.telefone,
      cidade: e.cidade,
      uf: e.uf,
      status: statusEfetivo(e.status, e.assinaturaAte, hoje),
      motivoStatus: e.motivoStatus,
      plano: e.idPlano ? { id: e.idPlano, nome: nomesPlano.get(e.idPlano) ?? '' } : null,
      assinaturaAte: e.assinaturaAte,
      bancoProvisionado: e.bancoProvisionado,
      usuarios: Number(porEmpresa.get(e.id)?.total ?? 0),
      usuariosAtivos: Number(porEmpresa.get(e.id)?.ativos ?? 0),
      criadaEm: e.criadaEm,
      ativadaEm: e.ativadaEm,
      suspensaEm: e.suspensaEm,
    }));
  }

  private async buscarEmpresa(id: number): Promise<PlataformaEmpresa> {
    const empresa = await this.empresas.findOne({ where: { id } });
    if (!empresa) throw new NotFoundException('Empresa não encontrada');
    return empresa;
  }

  private async planoAtivo(id: number): Promise<void> {
    const plano = await this.planos.findOne({ where: { id } });
    if (!plano || !plano.ativo) throw new BadRequestException('Plano inexistente ou inativo');
  }

  private async planoPadrao(): Promise<number | null> {
    const plano = await this.planos.findOne({ where: { ativo: true }, order: { id: 'ASC' } });
    return plano?.id ?? null;
  }
}
