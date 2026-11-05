import path from 'node:path';
import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfiguracaoService } from '../config/configuracao.service.js';
import { CONEXAO_PLATAFORMA } from '../auth/sessao-usuario.service.js';
import { Backup, Importacao, Plano, PlataformaEmpresa, PlataformaUsuario } from '../plataforma/entities/index.js';
import { BackupsController, BackupsPlataformaController } from './backups.controller.js';
import { BackupsService } from './backups.service.js';
import { ImportacoesController } from './importacoes.controller.js';
import { ImportacoesService } from './importacoes.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Backup, Importacao, Plano, PlataformaEmpresa, PlataformaUsuario], CONEXAO_PLATAFORMA),
    MulterModule.registerAsync({
      inject: [ConfiguracaoService],
      useFactory: (config: ConfiguracaoService) => ({
        dest: path.resolve(config.valores.backup.diretorio, 'importacoes', 'recebidos'),
        limits: { fileSize: config.valores.backup.importacaoMaxMb * 1024 * 1024, files: 1, fields: 5 },
      }),
    }),
  ],
  controllers: [BackupsController, BackupsPlataformaController, ImportacoesController],
  providers: [BackupsService, ImportacoesService],
  exports: [BackupsService, ImportacoesService],
})
export class BackupsModule {}
