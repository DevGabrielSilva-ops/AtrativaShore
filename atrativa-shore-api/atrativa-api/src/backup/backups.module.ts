import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CONEXAO_PLATAFORMA } from '../auth/sessao-usuario.service.js';
import { Backup, PlataformaEmpresa, PlataformaUsuario } from '../plataforma/entities/index.js';
import { BackupsController, BackupsPlataformaController } from './backups.controller.js';
import { BackupsService } from './backups.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Backup, PlataformaEmpresa, PlataformaUsuario], CONEXAO_PLATAFORMA)],
  controllers: [BackupsController, BackupsPlataformaController],
  providers: [BackupsService],
  exports: [BackupsService],
})
export class BackupsModule {}
