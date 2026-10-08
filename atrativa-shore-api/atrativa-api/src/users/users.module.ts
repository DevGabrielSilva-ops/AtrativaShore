import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Cliente } from "../entities/clientes/cliente.entity.js";
import { UsersController } from "./controller/users.controller.js";
import { UsersService } from "./service/users.service.js";

@Module({
    imports: [TypeOrmModule.forFeature([Cliente])],
    controllers: [UsersController],
    providers: [UsersService]
})

export class UsersModule { }