import { Module } from '@nestjs/common';
import { EmpresaModule } from '../empresa/empresa.module.js';
import { VendasController, VendasDoClienteController } from './vendas.controller.js';
import { VendasService } from './vendas.service.js';

@Module({
  imports: [EmpresaModule],
  controllers: [VendasController, VendasDoClienteController],
  providers: [VendasService],
  exports: [VendasService],
})
export class VendasModule {}
