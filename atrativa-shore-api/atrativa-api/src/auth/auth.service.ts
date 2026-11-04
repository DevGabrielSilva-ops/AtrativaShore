import { timingSafeEqual } from 'node:crypto';
import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import bcrypt from 'bcrypt';
import type { Repository } from 'typeorm';
import { ConfiguracaoService } from '../config/configuracao.service.js';
import { Credencial } from '../usuarios/entities/credencial.entity.js';
import { UsuariosService } from '../usuarios/usuarios.service.js';
import type { PayloadJwt, UsuarioAutenticado } from './usuario-autenticado.js';

export interface RespostaLogin {
  accessToken: string;
  tokenType: 'Bearer';
  expiresAt: string;
  usuario: UsuarioAutenticado;
}

const MENSAGEM_CREDENCIAIS = 'Usuário ou senha inválidos';

function textosIguais(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, 'utf8');
  const bufferB = Buffer.from(b, 'utf8');
  return bufferA.length === bufferB.length && timingSafeEqual(bufferA, bufferB);
}

/**
 * Autenticação.
 *
 * O banco legado guarda a senha em texto puro (cad_login.senha). Para não
 * quebrar o desktop, a API não altera essa coluna: no PRIMEIRO login de cada
 * usuário ela confere a senha legada e grava um hash bcrypt em
 * api_credencial. Daí em diante a API só usa o hash.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger('Auth');
  /** Hash descartável comparado quando o usuário não existe, para o tempo de resposta não revelar isso. */
  private readonly hashFicticio: string;

  constructor(
    private readonly usuarios: UsuariosService,
    private readonly jwt: JwtService,
    private readonly config: ConfiguracaoService,
    @InjectRepository(Credencial) private readonly credenciais: Repository<Credencial>,
  ) {
    this.hashFicticio = bcrypt.hashSync('senha-inexistente', config.valores.bcryptRodadas);
  }

  async login(login: string, senha: string): Promise<RespostaLogin> {
    const usuario = await this.usuarios.buscarParaAutenticacao(login);
    if (!usuario) {
      await bcrypt.compare(senha, this.hashFicticio);
      throw new UnauthorizedException(MENSAGEM_CREDENCIAIS);
    }

    const credencial = await this.credenciais.findOne({ where: { idLogin: usuario.id } });
    if (credencial) {
      if (!(await bcrypt.compare(senha, credencial.senhaHash))) {
        throw new UnauthorizedException(MENSAGEM_CREDENCIAIS);
      }
    } else {
      const legada = usuario.senhaLegada ?? '';
      if (legada === '' || !textosIguais(senha, legada)) {
        await bcrypt.compare(senha, this.hashFicticio);
        throw new UnauthorizedException(MENSAGEM_CREDENCIAIS);
      }
      await this.gravarHash(usuario.id, senha);
      this.logger.log(`Senha do usuário #${usuario.id} migrada para bcrypt em api_credencial`);
    }

    const autenticado = await this.usuarios.montarAutenticado(usuario);
    const payload: PayloadJwt = { sub: autenticado.id, login: autenticado.login, perfil: autenticado.idPerfil };
    const accessToken = await this.jwt.signAsync(payload);
    const { exp } = this.jwt.decode<{ exp: number }>(accessToken);

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresAt: new Date(exp * 1000).toISOString(),
      usuario: autenticado,
    };
  }

  async alterarSenha(usuario: UsuarioAutenticado, senhaAtual: string, novaSenha: string): Promise<void> {
    if (senhaAtual === novaSenha) {
      throw new BadRequestException('A nova senha deve ser diferente da atual');
    }
    // Reaproveita a validação do login (inclusive a migração da senha legada).
    try {
      await this.login(usuario.login, senhaAtual);
    } catch {
      throw new UnauthorizedException('Senha atual incorreta');
    }
    await this.gravarHash(usuario.id, novaSenha);
  }

  private async gravarHash(idLogin: number, senha: string): Promise<void> {
    const senhaHash = await bcrypt.hash(senha, this.config.valores.bcryptRodadas);
    await this.credenciais.upsert({ idLogin, senhaHash }, ['idLogin']);
  }
}
