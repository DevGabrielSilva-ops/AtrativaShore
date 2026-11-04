import { Module } from '@nestjs/common';
import { CargosController, FuncionariosController } from './funcionarios.controller.js';
import { FuncionariosService } from './funcionarios.service.js';

@Module({
  controllers: [FuncionariosController, CargosController],
  providers: [FuncionariosService],
  exports: [FuncionariosService],
})
export class FuncionariosModule {}
