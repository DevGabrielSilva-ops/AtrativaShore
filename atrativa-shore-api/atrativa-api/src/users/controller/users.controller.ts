import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { UsersService } from "../service/users.service.js";
import { CreateClienteDto } from "../DTO/user.dto.js";

@Controller('cad_cliente')
export class UsersController {
    constructor(
        private usersService: UsersService
    ) { }

    @Get()
    findClient() {
        return this.usersService.findClient()
    }

    @Get(':id')
    findClientById(@Param('id') id: number) {
        return this.usersService.findClientById(+id)
    }

    @Post('create')
    createClient(@Body() client: CreateClienteDto) {
        return this.usersService.createClient(client)
    }
}