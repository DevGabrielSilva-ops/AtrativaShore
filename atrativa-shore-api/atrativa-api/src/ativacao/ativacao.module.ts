import { Module } from '@nestjs/common';
import { FuncionariosModule } from '../funcionarios/funcionarios.module.js';
import { AtivacaoController } from './ativacao.controller.js';
import { AtivacaoService } from './ativacao.service.js';

@Module({
  imports: [FuncionariosModule],
  controllers: [AtivacaoController],
  providers: [AtivacaoService],
})
export class AtivacaoModule {}
