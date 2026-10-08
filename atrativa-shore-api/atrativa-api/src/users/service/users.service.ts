import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Cliente } from "../../entities/clientes/cliente.entity.js";
import { Repository } from "typeorm";
import { CreateClienteDto } from "../DTO/user.dto.js";

@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(Cliente)
        private usersRepository: Repository<Cliente>,
    ) { }

    findClient() {
        return this.usersRepository.find()
    }

    async findClientById(id: number) {
        const cliente = await this.usersRepository.findOne({
            where: {
                id: id
            }
        })

        if (!cliente) {
            throw new HttpException('Cliente não encontrado', HttpStatus.NOT_FOUND)
        }

        return cliente
    }

    async createClient(client: CreateClienteDto) {
        const cliente = this.usersRepository.create(client);

        if (!cliente) {
            throw new HttpException('Não foi possivel criar o cliente', HttpStatus.CONFLICT)
        }

        return await this.usersRepository.save(cliente);
    }
}