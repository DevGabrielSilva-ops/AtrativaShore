import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfiguracaoService } from '../config/configuracao.service.js';
import { opcoesBanco } from './opcoes-banco.js';
import { VerificacaoBancoService } from './verificacao-banco.service.js';

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfiguracaoService],
      useFactory: (config: ConfiguracaoService) => opcoesBanco(config.valores),
    }),
  ],
  providers: [VerificacaoBancoService],
  exports: [VerificacaoBancoService],
})
export class DatabaseModule {}
