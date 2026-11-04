import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfiguracaoService } from '../../config/configuracao.service.js';
import { UsuariosService } from '../../usuarios/usuarios.service.js';
import type { PayloadJwt, UsuarioAutenticado } from '../usuario-autenticado.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfiguracaoService,
    private readonly usuarios: UsuariosService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.valores.jwt.segredo,
    });
  }

  /** Confere a cada requisição se o usuário ainda existe (pode ter sido removido no desktop). */
  async validate(payload: PayloadJwt): Promise<UsuarioAutenticado> {
    const usuario = await this.usuarios.buscarPorId(payload.sub);
    if (!usuario) throw new UnauthorizedException('Usuário não existe mais');
    return this.usuarios.montarAutenticado(usuario);
  }
}
