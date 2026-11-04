import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CONEXAO_PLATAFORMA } from '../auth/sessao-usuario.service.js';
import { ConfiguracaoService } from '../config/configuracao.service.js';
import { TenancyModule } from '../tenancy/tenancy.module.js';
import { opcoesPlataforma } from './opcoes-banco.js';
import { VerificacaoBancoService } from './verificacao-banco.service.js';

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      name: CONEXAO_PLATAFORMA,
      inject: [ConfiguracaoService],
      useFactory: (config: ConfiguracaoService) => opcoesPlataforma(config.valores),
    }),
    TenancyModule,
  ],
  providers: [VerificacaoBancoService],
  exports: [VerificacaoBancoService, TenancyModule],
})
export class DatabaseModule {}
