import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CaixaController } from './caixa.controller.js';
import { CaixaService } from './caixa.service.js';
import { FechamentoCaixa } from './entities/fechamento-caixa.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([FechamentoCaixa])],
  controllers: [CaixaController],
  providers: [CaixaService],
  exports: [CaixaService],
})
export class CaixaModule {}
