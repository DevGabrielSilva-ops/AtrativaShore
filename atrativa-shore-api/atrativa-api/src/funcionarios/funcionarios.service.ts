import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import bcrypt from 'bcrypt';
import { Not, type Repository } from 'typeorm';
import { calcularPermissoes, PERMISSOES, type Permissao, permissaoValida, ROTULOS_PAPEL } from '../acesso/permissoes.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { AuthService } from '../auth/auth.service.js';
import { CONEXAO_PLATAFORMA } from '../auth/sessao-usuario.service.js';
import type { UsuarioAutenticado } from '../auth/usuario-autenticado.js';
import { offset, paginado, type Paginado } from '../common/dto/paginacao.dto.js';
import { senhaTemporaria } from '../common/utils/segredos.js';
import { ConfiguracaoService } from '../config/configuracao.service.js';
import { Cargo, Plano, PlataformaEmpresa, PlataformaUsuario } from '../plataforma/entities/index.js';
import type { PapelEmpresa } from '../plataforma/entities/papeis.js';
import { ProvisionamentoService } from '../tenancy/provisionamento.service.js';
import type {
  AtualizarFuncionarioDto,
  CargoDto,
  CriarFuncionarioDto,
  ListarFuncionariosDto,
} from './dto/funcionario.dto.js';

export interface FuncionarioResposta {
  id: number;
  nome: string;
  email: string | null;
  login: string | null;
  papel: PapelEmpresa;
  papelRotulo: string;
  cargo: { id: number; nome: string } | null;
  permissoes: Permissao[];
  status: string;
  trocarSenha: boolean;
  ultimoLoginEm: Date | null;
  criadoEm: Date;
  idLogin: number | null;
}

@Injectable()
export class FuncionariosService {
  constructor(
    @InjectRepository(PlataformaUsuario, CONEXAO_PLATAFORMA) private readonly usuarios: Repository<PlataformaUsuario>,
    @InjectRepository(Cargo, CONEXAO_PLATAFORMA) private readonly cargos: Repository<Cargo>,
    @InjectRepository(PlataformaEmpresa, CONEXAO_PLATAFORMA) private readonly empresas: Repository<PlataformaEmpresa>,
    @InjectRepository(Plano, CONEXAO_PLATAFORMA) private readonly planos: Repository<Plano>,
    private readonly provisionamento: ProvisionamentoService,
    private readonly auth: AuthService,
    private readonly auditoria: AuditoriaService,
    private readonly config: ConfiguracaoService,
  ) {}

  catalogo() {
    return {
      papeis: (['COMPANY_ADMIN', 'MANAGER', 'SELLER', 'STOCK_OPERATOR'] as const).map((papel) => ({
        id: papel,
        rotulo: ROTULOS_PAPEL[papel],
        permissoes: calcularPermissoes(papel),
      })),
      permissoes: Object.entries(PERMISSOES).map(([id, info]) => ({ id, ...info })),
    };
  }

  async listar(idEmpresa: number, filtro: ListarFuncionariosDto): Promise<Paginado<FuncionarioResposta>> {
    const consulta = this.usuarios
      .createQueryBuilder('u')
      .where('u.idEmpresa = :idEmpresa', { idEmpresa })
      .orderBy('u.nome', 'ASC');
    if (filtro.busca) {
      consulta.andWhere('(u.nome LIKE :busca OR u.email LIKE :busca OR u.login LIKE :busca)', {
        busca: `%${filtro.busca}%`,
      });
    }
    if (filtro.status) consulta.andWhere('u.status = :status', { status: filtro.status });
    if (filtro.papel) consulta.andWhere('u.papel = :papel', { papel: filtro.papel });
    const [linhas, total] = await consulta.skip(offset(filtro)).take(filtro.limit).getManyAndCount();
    const cargos = await this.cargosPorId(idEmpresa);
    return paginado(
      linhas.map((u) => this.mapear(u, cargos)),
      total,
      filtro.page,
      filtro.limit,
    );
  }

  async obter(idEmpresa: number, id: number): Promise<FuncionarioResposta> {
    const usuario = await this.buscar(idEmpresa, id);
    return this.mapear(usuario, await this.cargosPorId(idEmpresa));
  }

  async criar(
    autor: UsuarioAutenticado,
    dto: CriarFuncionarioDto,
  ): Promise<{ funcionario: FuncionarioResposta; senhaTemporaria: string | null }> {
    const idEmpresa = autor.idEmpresa!;
    if (!dto.email && !dto.login) throw new BadRequestException('Informe o e-mail ou o usuário de acesso');
    await this.garantirLimiteDoPlano(idEmpresa);
    await this.garantirIdentificadoresLivres(dto.email ?? null, dto.login ?? null);
    const cargo = await this.validarCargo(idEmpresa, dto.papel, dto.idCargo ?? null);

    const senha = dto.senha ?? senhaTemporaria();
    const banco = autor.empresa!.banco;
    const idLoginLegado = await this.provisionamento.criarLoginEspelho(banco, dto.login ?? dto.nome);
    const senhaHash = await bcrypt.hash(senha, this.config.valores.bcryptRodadas);
    const salvo = await this.usuarios.save(
      this.usuarios.create({
        idEmpresa,
        nome: dto.nome,
        email: dto.email?.toLowerCase() ?? null,
        login: dto.login ?? null,
        senhaHash,
        papel: dto.papel,
        idCargo: cargo?.id ?? null,
        status: 'ACTIVE',
        trocarSenha: true,
        idLoginLegado,
        criadoPor: autor.id,
      }),
    );
    await this.auditoria.registrar({
      acao: 'funcionario.criar',
      entidade: 'usuario',
      idEntidade: salvo.id,
      detalhes: { nome: salvo.nome, papel: salvo.papel, cargo: cargo?.nome ?? null },
    });
    return {
      funcionario: await this.obter(idEmpresa, salvo.id),
      senhaTemporaria: dto.senha ? null : senha,
    };
  }

  async atualizar(autor: UsuarioAutenticado, id: number, dto: AtualizarFuncionarioDto): Promise<FuncionarioResposta> {
    const idEmpresa = autor.idEmpresa!;
    const usuario = await this.buscar(idEmpresa, id);
    const mudaAcesso =
      (dto.papel !== undefined && dto.papel !== usuario.papel) ||
      (dto.idCargo !== undefined && (dto.idCargo ?? null) !== usuario.idCargo);
    if (mudaAcesso && usuario.id === autor.id) {
      throw new ForbiddenException('Você não pode alterar o próprio cargo ou permissões');
    }

    const email = dto.email === undefined ? usuario.email : (dto.email?.toLowerCase() ?? null);
    const login = dto.login === undefined ? usuario.login : (dto.login ?? null);
    if (!email && !login) throw new BadRequestException('O funcionário precisa de e-mail ou usuário de acesso');
    await this.garantirIdentificadoresLivres(
      email !== usuario.email ? email : null,
      login !== usuario.login ? login : null,
      usuario.id,
    );

    const papel = dto.papel ?? usuario.papel;
    if (papel === 'SUPER_ADMIN') throw new ForbiddenException('Papel inválido');
    const idCargo = dto.idCargo === undefined ? usuario.idCargo : dto.idCargo;
    const cargo = await this.validarCargo(idEmpresa, papel as PapelEmpresa, idCargo ?? null);
    if (usuario.papel === 'COMPANY_ADMIN' && papel !== 'COMPANY_ADMIN') await this.garantirOutroAdmin(idEmpresa, usuario.id);

    await this.usuarios.update(
      { id: usuario.id },
      {
        nome: dto.nome ?? usuario.nome,
        email,
        login,
        papel,
        idCargo: cargo?.id ?? null,
        ...(mudaAcesso ? { versaoToken: usuario.versaoToken + 1 } : {}),
      },
    );
    if (mudaAcesso) await this.auth.revogarTodas(usuario.id);
    await this.auditoria.registrar({
      acao: mudaAcesso ? 'funcionario.permissoes_alteradas' : 'funcionario.atualizar',
      entidade: 'usuario',
      idEntidade: usuario.id,
      detalhes: { antes: { papel: usuario.papel, idCargo: usuario.idCargo }, depois: { papel, idCargo: cargo?.id ?? null }, dados: dto },
    });
    return this.obter(idEmpresa, usuario.id);
  }

  async alterarStatus(autor: UsuarioAutenticado, id: number, status: 'ACTIVE' | 'INACTIVE'): Promise<FuncionarioResposta> {
    const idEmpresa = autor.idEmpresa!;
    const usuario = await this.buscar(idEmpresa, id);
    if (usuario.id === autor.id) throw new ForbiddenException('Você não pode desativar o próprio acesso');
    if (status === usuario.status) return this.obter(idEmpresa, id);
    if (status === 'INACTIVE' && usuario.papel === 'COMPANY_ADMIN') await this.garantirOutroAdmin(idEmpresa, usuario.id);
    if (status === 'ACTIVE') await this.garantirLimiteDoPlano(idEmpresa);
    await this.usuarios.update({ id }, { status, versaoToken: usuario.versaoToken + 1 });
    await this.auth.revogarTodas(id);
    await this.auditoria.registrar({
      acao: status === 'ACTIVE' ? 'funcionario.ativar' : 'funcionario.desativar',
      entidade: 'usuario',
      idEntidade: id,
    });
    return this.obter(idEmpresa, id);
  }

  async redefinirSenha(autor: UsuarioAutenticado, id: number): Promise<{ senhaTemporaria: string }> {
    const usuario = await this.buscar(autor.idEmpresa!, id);
    if (usuario.id === autor.id) throw new BadRequestException('Use a troca de senha do seu perfil');
    return this.gerarSenhaTemporaria(usuario);
  }

  async gerarSenhaTemporaria(usuario: PlataformaUsuario): Promise<{ senhaTemporaria: string }> {
    const senha = senhaTemporaria();
    const senhaHash = await bcrypt.hash(senha, this.config.valores.bcryptRodadas);
    await this.usuarios.update({ id: usuario.id }, { senhaHash, trocarSenha: true, versaoToken: usuario.versaoToken + 1 });
    await this.auth.revogarTodas(usuario.id);
    await this.auditoria.registrar({ acao: 'funcionario.senha_redefinida', entidade: 'usuario', idEntidade: usuario.id });
    return { senhaTemporaria: senha };
  }

  async listarCargos(idEmpresa: number) {
    const [cargos, contagem] = await Promise.all([
      this.cargos.find({ where: { idEmpresa }, order: { nome: 'ASC' } }),
      this.usuarios
        .createQueryBuilder('u')
        .select('u.idCargo', 'idCargo')
        .addSelect('COUNT(*)', 'total')
        .where('u.idEmpresa = :idEmpresa AND u.idCargo IS NOT NULL', { idEmpresa })
        .groupBy('u.idCargo')
        .getRawMany<{ idCargo: number; total: string }>(),
    ]);
    const usos = new Map(contagem.map((linha) => [Number(linha.idCargo), Number(linha.total)]));
    return cargos.map((cargo) => ({ ...cargo, funcionarios: usos.get(cargo.id) ?? 0 }));
  }

  async criarCargo(autor: UsuarioAutenticado, dto: CargoDto) {
    const permissoes = this.validarPermissoes(autor, dto.permissoes);
    await this.garantirNomeCargoLivre(autor.idEmpresa!, dto.nome);
    const cargo = await this.cargos.save(
      this.cargos.create({ idEmpresa: autor.idEmpresa!, nome: dto.nome, papelBase: dto.papelBase, permissoes }),
    );
    await this.auditoria.registrar({ acao: 'cargo.criar', entidade: 'cargo', idEntidade: cargo.id, detalhes: dto });
    return cargo;
  }

  async atualizarCargo(autor: UsuarioAutenticado, id: number, dto: CargoDto) {
    const cargo = await this.cargos.findOne({ where: { id, idEmpresa: autor.idEmpresa! } });
    if (!cargo) throw new NotFoundException('Cargo não encontrado');
    const permissoes = this.validarPermissoes(autor, dto.permissoes);
    if (dto.nome !== cargo.nome) await this.garantirNomeCargoLivre(autor.idEmpresa!, dto.nome, id);
    await this.cargos.update({ id }, { nome: dto.nome, papelBase: dto.papelBase, permissoes });
    const afetados = await this.usuarios.find({ where: { idCargo: id } });
    for (const usuario of afetados) {
      await this.usuarios.update({ id: usuario.id }, { versaoToken: usuario.versaoToken + 1 });
      await this.auth.revogarTodas(usuario.id);
    }
    await this.auditoria.registrar({
      acao: 'cargo.permissoes_alteradas',
      entidade: 'cargo',
      idEntidade: id,
      detalhes: { antes: cargo.permissoes, depois: permissoes, funcionariosAfetados: afetados.length },
    });
    return this.cargos.findOneByOrFail({ id });
  }

  async removerCargo(autor: UsuarioAutenticado, id: number): Promise<void> {
    const cargo = await this.cargos.findOne({ where: { id, idEmpresa: autor.idEmpresa! } });
    if (!cargo) throw new NotFoundException('Cargo não encontrado');
    if (await this.usuarios.exists({ where: { idCargo: id } })) {
      throw new ConflictException('Há funcionários com este cargo. Troque o cargo deles antes de excluir.');
    }
    await this.cargos.delete({ id });
    await this.auditoria.registrar({ acao: 'cargo.excluir', entidade: 'cargo', idEntidade: id, detalhes: { nome: cargo.nome } });
  }

  private validarPermissoes(autor: UsuarioAutenticado, permissoes: string[]): Permissao[] {
    const invalidas = permissoes.filter((p) => !permissaoValida(p));
    if (invalidas.length) throw new BadRequestException(`Permissões inexistentes: ${invalidas.join(', ')}`);
    const acima = permissoes.filter((p) => !autor.permissoes.includes(p as Permissao));
    if (acima.length) throw new ForbiddenException(`Você não pode conceder permissões que não tem: ${acima.join(', ')}`);
    return permissoes as Permissao[];
  }

  private async validarCargo(idEmpresa: number, papel: PapelEmpresa, idCargo: number | null): Promise<Cargo | null> {
    if (idCargo === null) return null;
    if (papel === 'COMPANY_ADMIN') throw new BadRequestException('O administrador da empresa não usa cargo personalizado');
    const cargo = await this.cargos.findOne({ where: { id: idCargo, idEmpresa } });
    if (!cargo) throw new BadRequestException('Cargo não encontrado nesta empresa');
    return cargo;
  }

  private async garantirNomeCargoLivre(idEmpresa: number, nome: string, ignorar?: number): Promise<void> {
    const existe = await this.cargos.exists({ where: { idEmpresa, nome, ...(ignorar ? { id: Not(ignorar) } : {}) } });
    if (existe) throw new ConflictException('Já existe um cargo com este nome');
  }

  async garantirIdentificadoresLivres(email: string | null, login: string | null, ignorar?: number): Promise<void> {
    const filtroId = ignorar ? { id: Not(ignorar) } : {};
    if (email && (await this.usuarios.exists({ where: { email: email.toLowerCase(), ...filtroId } }))) {
      throw new ConflictException('Este e-mail já está em uso na plataforma');
    }
    if (login && (await this.usuarios.exists({ where: { login, ...filtroId } }))) {
      throw new ConflictException('Este usuário de acesso já está em uso na plataforma');
    }
  }

  private async garantirOutroAdmin(idEmpresa: number, idUsuario: number): Promise<void> {
    const outros = await this.usuarios.count({
      where: { idEmpresa, papel: 'COMPANY_ADMIN', status: 'ACTIVE', id: Not(idUsuario) },
    });
    if (outros === 0) throw new ConflictException('A empresa precisa de pelo menos um administrador ativo');
  }

  private async garantirLimiteDoPlano(idEmpresa: number): Promise<void> {
    const empresa = await this.empresas.findOne({ where: { id: idEmpresa } });
    const plano = empresa?.idPlano ? await this.planos.findOne({ where: { id: empresa.idPlano } }) : null;
    if (!plano?.maxFuncionarios) return;
    const ativos = await this.usuarios.count({ where: { idEmpresa, status: 'ACTIVE' } });
    if (ativos >= plano.maxFuncionarios) {
      throw new ConflictException(`O plano ${plano.nome} permite até ${plano.maxFuncionarios} usuários ativos`);
    }
  }

  private async buscar(idEmpresa: number, id: number): Promise<PlataformaUsuario> {
    const usuario = await this.usuarios.findOne({ where: { id, idEmpresa } });
    if (!usuario) throw new NotFoundException('Funcionário não encontrado');
    return usuario;
  }

  private async cargosPorId(idEmpresa: number): Promise<Map<number, Cargo>> {
    const cargos = await this.cargos.find({ where: { idEmpresa } });
    return new Map(cargos.map((cargo) => [cargo.id, cargo]));
  }

  private mapear(usuario: PlataformaUsuario, cargos: Map<number, Cargo>): FuncionarioResposta {
    const cargo = usuario.idCargo ? (cargos.get(usuario.idCargo) ?? null) : null;
    const papel = usuario.papel as PapelEmpresa;
    return {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      login: usuario.login,
      papel,
      papelRotulo: ROTULOS_PAPEL[papel],
      cargo: cargo ? { id: cargo.id, nome: cargo.nome } : null,
      permissoes: calcularPermissoes(papel, cargo?.permissoes),
      status: usuario.status,
      trocarSenha: usuario.trocarSenha,
      ultimoLoginEm: usuario.ultimoLoginEm,
      criadoEm: usuario.criadoEm,
      idLogin: usuario.idLoginLegado,
    };
  }
}
