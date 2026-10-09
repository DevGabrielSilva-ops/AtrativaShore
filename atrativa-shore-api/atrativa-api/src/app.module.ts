import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cliente } from './entities/clientes/cliente.entity.js';
import { UsersModule } from './users/users.module.js';
import { Produtos } from './entities/produtos/produtos.entity.js';
import { ProdutoModule } from './produtos/produto.module.js';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: 'localhost',
      port: 3306,
      username: 'atrativa',
      password: 'admin',
      database: 'atrativaLoja',
      entities: [Cliente,Produtos],
      synchronize: true,
    }),

    UsersModule,
    ProdutoModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
