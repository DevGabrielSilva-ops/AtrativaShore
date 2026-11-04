import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProdutosModule } from '../produtos/produtos.module.js';
import { EstoqueHistorico } from './entities/estoque-historico.entity.js';
import { Estoque } from './entities/estoque.entity.js';
import { EstoqueController } from './estoque.controller.js';
import { EstoqueService } from './estoque.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Estoque, EstoqueHistorico]), ProdutosModule],
  controllers: [EstoqueController],
  providers: [EstoqueService],
  exports: [EstoqueService],
})
export class EstoqueModule {}
