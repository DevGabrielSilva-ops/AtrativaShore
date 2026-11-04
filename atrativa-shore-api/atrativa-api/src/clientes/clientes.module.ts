import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientesController } from './clientes.controller.js';
import { ClientesService } from './clientes.service.js';
import { ClienteObservacao } from './entities/cliente-observacao.entity.js';
import { Cliente } from './entities/cliente.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Cliente, ClienteObservacao])],
  controllers: [ClientesController],
  providers: [ClientesService],
  exports: [ClientesService],
})
export class ClientesModule {}
