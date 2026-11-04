import { Global, Module } from '@nestjs/common';
import { JwtModule, type JwtSignOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfiguracaoService } from '../config/configuracao.service.js';
import { ENTIDADES_PLATAFORMA } from '../plataforma/entities/index.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { CONEXAO_PLATAFORMA, SessaoUsuarioService } from './sessao-usuario.service.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';

@Global()
@Module({
  imports: [
    PassportModule,
    TypeOrmModule.forFeature(ENTIDADES_PLATAFORMA, CONEXAO_PLATAFORMA),
    JwtModule.registerAsync({
      inject: [ConfiguracaoService],
      useFactory: (config: ConfiguracaoService) => ({
        secret: config.valores.jwt.segredo,
        signOptions: {
          expiresIn: config.valores.jwt.expiraEm as JwtSignOptions['expiresIn'],
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, SessaoUsuarioService],
  exports: [AuthService, SessaoUsuarioService, TypeOrmModule],
})
export class AuthModule {}
