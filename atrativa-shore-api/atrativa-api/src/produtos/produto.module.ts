import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Produtos } from "../entities/produtos/produtos.entity.js";
import { ProdutoController } from "./controllers/produto.controller.js";
import { ProdutoService } from "./services/produto.service.js";


@Module({
    imports: [TypeOrmModule.forFeature([Produtos])],
    providers: [ProdutoService],
    controllers: [ProdutoController]
})
export class ProdutoModule {}