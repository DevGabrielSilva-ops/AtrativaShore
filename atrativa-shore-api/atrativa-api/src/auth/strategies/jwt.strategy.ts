import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfiguracaoService } from '../../config/configuracao.service.js';
import { SessaoUsuarioService } from '../sessao-usuario.service.js';
import type { PayloadJwt, UsuarioAutenticado } from '../usuario-autenticado.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfiguracaoService,
    private readonly sessoes: SessaoUsuarioService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.valores.jwt.segredo,
    });
  }

  validate(payload: PayloadJwt): Promise<UsuarioAutenticado> {
    return this.sessoes.porToken(payload.sub, payload.ver);
  }
}
