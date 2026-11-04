import { Module } from '@nestjs/common';
import { EstoqueModule } from '../estoque/estoque.module.js';
import { ProdutosModule } from '../produtos/produtos.module.js';
import { VendasModule } from '../vendas/vendas.module.js';
import { RelatoriosController } from './relatorios.controller.js';
import { RelatoriosService } from './relatorios.service.js';

@Module({
  imports: [VendasModule, ProdutosModule, EstoqueModule],
  controllers: [RelatoriosController],
  providers: [RelatoriosService],
})
export class RelatoriosModule {}
