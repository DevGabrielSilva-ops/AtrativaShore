import { Body, Controller, Get, Post } from "@nestjs/common";
import { ProdutoService } from "../services/produto.service.js";
import { CreateProdutoDto } from "../DTO/produto.dto.js";

@Controller('cad_produto')
export class ProdutoController {
    constructor(
        private readonly produtoService: ProdutoService
    ){}
    
    @Get()
    findProductAll(){
        return this.produtoService.findProductAll()
    }

    @Post('create')
    createProduct(@Body() produto: CreateProdutoDto){
        return this.produtoService.createProduct(produto)

    }
}