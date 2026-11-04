import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmpresaModule } from '../empresa/empresa.module.js';
import { VendaItem } from './entities/venda-item.entity.js';
import { Venda } from './entities/venda.entity.js';
import { VendasController, VendasDoClienteController } from './vendas.controller.js';
import { VendasService } from './vendas.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Venda, VendaItem]), EmpresaModule],
  controllers: [VendasController, VendasDoClienteController],
  providers: [VendasService],
  exports: [VendasService],
})
export class VendasModule {}
