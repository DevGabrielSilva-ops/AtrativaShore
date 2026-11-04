import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProdutoTipo } from './entities/produto-tipo.entity.js';
import { Produto } from './entities/produto.entity.js';
import { ProdutosController } from './produtos.controller.js';
import { ProdutosService } from './produtos.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Produto, ProdutoTipo])],
  controllers: [ProdutosController],
  providers: [ProdutosService],
  exports: [ProdutosService],
})
export class ProdutosModule {}
