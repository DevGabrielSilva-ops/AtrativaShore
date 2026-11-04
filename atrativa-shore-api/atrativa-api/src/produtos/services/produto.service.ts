import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Produtos } from "../../entities/produtos/produtos.entity.js";
import { Repository } from "typeorm";
import { CreateProdutoDto } from "../DTO/produto.dto.js";

@Injectable()
export class ProdutoService {
    constructor(
        @InjectRepository(Produtos)
        private productRepository: Repository<Produtos>
    ){}

    findProductAll(){
        return this.productRepository.find()
    }

    createProduct(produto: CreateProdutoDto){
        const Produtos = this.productRepository.create(produto)
        return this.productRepository.save(Produtos)
    }
}