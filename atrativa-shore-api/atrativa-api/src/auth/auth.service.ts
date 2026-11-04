import { timingSafeEqual } from 'node:crypto';
import { BadRequestException, ForbiddenException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import bcrypt from 'bcrypt';
import { DataSource, IsNull, type Repository } from 'typeorm';
import { MENSAGEM_STATUS_EMPRESA } from '../acesso/permissoes.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { LimitadorTentativas } from '../common/utils/limitador.js';
import { sha256, tokenAleatorio } from '../common/utils/segredos.js';
import { ConfiguracaoService } from '../config/configuracao.service.js';
import { PlataformaUsuario, RefreshToken } from '../plataforma/entities/index.js';
import { ConexoesEmpresaService } from '../tenancy/conexoes-empresa.service.js';
import { contextoAtual } from '../tenancy/contexto.js';
import { CONEXAO_PLATAFORMA, SessaoUsuarioService } from './sessao-usuario.service.js';
import { type PayloadJwt, type UsuarioAutenticado, usuarioPublico } from './usuario-autenticado.js';

export interface Sessao {
  accessToken: string;
  tokenType: 'Bearer';
  expiresAt: string;
  usuario: ReturnType<typeof usuarioPublico>;
}

export interface SessaoComRefresh {
  sessao: Sessao;
  refreshToken: string;
  refreshExpiraEm: Date;
  persistente: boolean;
}

const MENSAGEM_CREDENCIAIS = 'Usuário ou senha inválidos';

function textosIguais(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, 'utf8');
  const bufferB = Buffer.from(b, 'utf8');
  return bufferA.length === bufferB.length && timingSafeEqual(bufferA, bufferB);
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger('Auth');
  private readonly hashFicticio: string;
  private readonly limitador = new LimitadorTentativas(10, 15 * 60 * 1000);

  constructor(
    @InjectRepository(PlataformaUsuario, CONEXAO_PLATAFORMA) private readonly usuarios: Repository<PlataformaUsuario>,
    @InjectRepository(RefreshToken, CONEXAO_PLATAFORMA) private readonly tokens: Repository<RefreshToken>,
    @InjectDataSource(CONEXAO_PLATAFORMA) private readonly plataforma: DataSource,
    private readonly sessoes: SessaoUsuarioService,
    private readonly conexoes: ConexoesEmpresaService,
    private readonly auditoria: AuditoriaService,
    private readonly jwt: JwtService,
    private readonly config: ConfiguracaoService,
  ) {
    this.hashFicticio = bcrypt.hashSync('senha-inexistente', config.valores.bcryptRodadas);
  }

  async login(identificador: string, senha: string, lembrar: boolean): Promise<SessaoComRefresh> {
    const ip = contextoAtual()?.ip ?? 'desconhecido';
    const chave = `${ip}|${identificador.toLowerCase()}`;
    this.limitador.conferir(chave, 'Muitas tentativas de login. Aguarde alguns minutos e tente novamente.');

    const usuario = await this.usuarios
      .createQueryBuilder('u')
      .addSelect('u.senhaHash')
      .where('u.email = :id OR u.login = :id', { id: identificador.trim() })
      .getOne();

    if (!usuario || !(await this.senhaConfere(usuario, senha))) {
      await this.auditoria.registrar({
        acao: 'auth.login_falhou',
        entidade: 'usuario',
        idEntidade: usuario?.id ?? null,
        detalhes: { identificador: identificador.slice(0, 60) },
        idUsuario: usuario?.id ?? null,
        idEmpresa: usuario?.idEmpresa ?? null,
      });
      throw new UnauthorizedException(MENSAGEM_CREDENCIAIS);
    }
    this.limitador.limpar(chave);

    if (usuario.status !== 'ACTIVE') throw new ForbiddenException('Usuário desativado. Fale com o administrador da empresa.');
    const autenticado = await this.sessoes.montar(usuario);
    if (autenticado.empresa && autenticado.empresa.status !== 'ACTIVE') {
      throw new ForbiddenException(MENSAGEM_STATUS_EMPRESA[autenticado.empresa.status]);
    }

    await this.usuarios.update({ id: usuario.id }, { ultimoLoginEm: new Date() });
    await this.auditoria.registrar({
      acao: 'auth.login',
      entidade: 'usuario',
      idEntidade: usuario.id,
      idUsuario: usuario.id,
      idEmpresa: usuario.idEmpresa,
    });
    return this.emitir(autenticado, usuario.versaoToken, lembrar);
  }

  async renovar(refreshToken: string | undefined): Promise<SessaoComRefresh> {
    if (!refreshToken) throw new UnauthorizedException('Sessão expirada. Entre novamente.');
    const registro = await this.tokens.findOne({ where: { hash: sha256(refreshToken) } });
    if (!registro) throw new UnauthorizedException('Sessão expirada. Entre novamente.');

    if (registro.revogadoEm) {
      const recente = Date.now() - registro.revogadoEm.getTime() < 30_000;
      if (registro.substituidoPor && !recente) {
        await this.revogarTodas(registro.idUsuario);
        await this.auditoria.registrar({
          acao: 'auth.refresh_reutilizado',
          entidade: 'usuario',
          idEntidade: registro.idUsuario,
          idUsuario: registro.idUsuario,
        });
      }
      throw new UnauthorizedException('Sessão encerrada. Entre novamente.');
    }
    if (registro.expiraEm.getTime() <= Date.now()) throw new UnauthorizedException('Sessão expirada. Entre novamente.');

    const usuario = await this.usuarios.findOne({ where: { id: registro.idUsuario } });
    if (!usuario || usuario.status !== 'ACTIVE') {
      await this.tokens.update({ id: registro.id }, { revogadoEm: new Date() });
      throw new UnauthorizedException('Usuário desativado');
    }
    const autenticado = await this.sessoes.montar(usuario);
    if (autenticado.empresa && autenticado.empresa.status !== 'ACTIVE') {
      await this.tokens.update({ id: registro.id }, { revogadoEm: new Date() });
      throw new ForbiddenException(MENSAGEM_STATUS_EMPRESA[autenticado.empresa.status]);
    }

    const nova = await this.emitir(autenticado, usuario.versaoToken, registro.persistente);
    const novoRegistro = await this.tokens.findOne({ where: { hash: sha256(nova.refreshToken) } });
    await this.tokens.update({ id: registro.id }, { revogadoEm: new Date(), substituidoPor: novoRegistro?.id ?? null });
    return nova;
  }

  async sair(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    const registro = await this.tokens.findOne({ where: { hash: sha256(refreshToken) } });
    if (!registro || registro.revogadoEm) return;
    await this.tokens.update({ id: registro.id }, { revogadoEm: new Date() });
    const usuario = await this.usuarios.findOne({ where: { id: registro.idUsuario } });
    await this.auditoria.registrar({
      acao: 'auth.logout',
      entidade: 'usuario',
      idEntidade: registro.idUsuario,
      idUsuario: registro.idUsuario,
      idEmpresa: usuario?.idEmpresa ?? null,
    });
  }

  async alterarSenha(usuario: UsuarioAutenticado, senhaAtual: string, novaSenha: string): Promise<SessaoComRefresh> {
    if (senhaAtual === novaSenha) throw new BadRequestException('A nova senha deve ser diferente da atual');
    const registro = await this.usuarios
      .createQueryBuilder('u')
      .addSelect('u.senhaHash')
      .where('u.id = :id', { id: usuario.id })
      .getOne();
    if (!registro || !(await this.senhaConfere(registro, senhaAtual))) {
      throw new UnauthorizedException('Senha atual incorreta');
    }
    const senhaHash = await bcrypt.hash(novaSenha, this.config.valores.bcryptRodadas);
    const versaoToken = registro.versaoToken + 1;
    await this.usuarios.update({ id: usuario.id }, { senhaHash, trocarSenha: false, versaoToken });
    await this.revogarTodas(usuario.id);
    await this.auditoria.registrar({ acao: 'auth.senha_alterada', entidade: 'usuario', idEntidade: usuario.id });
    const atualizado = await this.sessoes.montar({ ...registro, trocarSenha: false, versaoToken });
    return this.emitir(atualizado, versaoToken, true);
  }

  async revogarTodas(idUsuario: number): Promise<void> {
    await this.tokens.update({ idUsuario, revogadoEm: IsNull() }, { revogadoEm: new Date() });
  }

  private async emitir(usuario: UsuarioAutenticado, versao: number, persistente: boolean): Promise<SessaoComRefresh> {
    const payload: PayloadJwt = { sub: usuario.id, ver: versao };
    const accessToken = await this.jwt.signAsync(payload);
    const { exp } = this.jwt.decode<{ exp: number }>(accessToken);

    const { refreshDias, refreshHorasSemLembrar } = this.config.valores.sessao;
    const duracao = persistente ? refreshDias * 24 * 3600 * 1000 : refreshHorasSemLembrar * 3600 * 1000;
    const refreshToken = tokenAleatorio(48);
    const refreshExpiraEm = new Date(Date.now() + duracao);
    const contexto = contextoAtual();
    await this.tokens.insert({
      idUsuario: usuario.id,
      hash: sha256(refreshToken),
      persistente,
      expiraEm: refreshExpiraEm,
      ip: contexto?.ip ?? null,
      userAgent: contexto?.userAgent ?? null,
    });

    return {
      sessao: {
        accessToken,
        tokenType: 'Bearer',
        expiresAt: new Date(exp * 1000).toISOString(),
        usuario: usuarioPublico(usuario),
      },
      refreshToken,
      refreshExpiraEm,
      persistente,
    };
  }

  private async senhaConfere(usuario: PlataformaUsuario, senha: string): Promise<boolean> {
    if (usuario.senhaHash) return bcrypt.compare(senha, usuario.senhaHash);
    if (!usuario.idLoginLegado || !usuario.idEmpresa) {
      await bcrypt.compare(senha, this.hashFicticio);
      return false;
    }
    const valida = await this.senhaLegadaConfere(usuario, senha);
    if (!valida) return false;
    const senhaHash = await bcrypt.hash(senha, this.config.valores.bcryptRodadas);
    await this.usuarios.update({ id: usuario.id }, { senhaHash });
    this.logger.log(`Senha do usuário #${usuario.id} migrada do banco da empresa para a plataforma`);
    return true;
  }

  private async senhaLegadaConfere(usuario: PlataformaUsuario, senha: string): Promise<boolean> {
    const [empresa] = (await this.plataforma.query('SELECT banco FROM plataforma_empresas WHERE id = ?', [
      usuario.idEmpresa,
    ])) as Array<{ banco: string }>;
    if (!empresa) return false;
    const fonte = await this.conexoes.obter(empresa.banco);
    const [credencial] = (await fonte
      .query('SELECT senha_hash FROM api_credencial WHERE id_login = ?', [usuario.idLoginLegado])
      .catch(() => [])) as Array<{ senha_hash: string }>;
    if (credencial) return bcrypt.compare(senha, credencial.senha_hash);
    const [legado] = (await fonte.query('SELECT senha FROM cad_login WHERE id = ?', [usuario.idLoginLegado])) as Array<{
      senha: string | null;
    }>;
    const senhaLegada = legado?.senha ?? '';
    if (senhaLegada === '' || !textosIguais(senha, senhaLegada)) {
      await bcrypt.compare(senha, this.hashFicticio);
      return false;
    }
    return true;
  }
}
