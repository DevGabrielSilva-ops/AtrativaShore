import { Module } from '@nestjs/common';
import { FuncionariosModule } from '../../funcionarios/funcionarios.module.js';
import { PlataformaController } from './plataforma.controller.js';
import { PlataformaService } from './plataforma.service.js';

@Module({
  imports: [FuncionariosModule],
  controllers: [PlataformaController],
  providers: [PlataformaService],
})
export class PlataformaModule {}
