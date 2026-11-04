import { Module } from '@nestjs/common';
import { FornecedoresController } from './fornecedores.controller.js';
import { FornecedoresService } from './fornecedores.service.js';

@Module({
  controllers: [FornecedoresController],
  providers: [FornecedoresService],
  exports: [FornecedoresService],
})
export class FornecedoresModule {}
