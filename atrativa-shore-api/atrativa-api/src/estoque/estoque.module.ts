import { Module } from '@nestjs/common';
import { ProdutosModule } from '../produtos/produtos.module.js';
import { EstoqueController } from './estoque.controller.js';
import { EstoqueService } from './estoque.service.js';

@Module({
  imports: [ProdutosModule],
  controllers: [EstoqueController],
  providers: [EstoqueService],
  exports: [EstoqueService],
})
export class EstoqueModule {}
