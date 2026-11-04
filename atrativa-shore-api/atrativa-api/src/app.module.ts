import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AuthModule } from './auth/auth.module.js';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard.js';
import { CaixaModule } from './caixa/caixa.module.js';
import { CarnesModule } from './carnes/carnes.module.js';
import { ClientesModule } from './clientes/clientes.module.js';
import { ExcecoesFilter } from './common/filters/excecoes.filter.js';
import { AdministradorGuard } from './common/guards/administrador.guard.js';
import { RespostaInterceptor } from './common/interceptors/resposta.interceptor.js';
import { ConfiguracaoModule } from './config/configuracao.module.js';
import { DatabaseModule } from './database/database.module.js';
import { EmpresaModule } from './empresa/empresa.module.js';
import { EstoqueModule } from './estoque/estoque.module.js';
import { FornecedoresModule } from './fornecedores/fornecedores.module.js';
import { ProdutosModule } from './produtos/produtos.module.js';
import { RelatoriosModule } from './relatorios/relatorios.module.js';
import { SaudeController } from './saude/saude.controller.js';
import { UsuariosModule } from './usuarios/usuarios.module.js';
import { VendasModule } from './vendas/vendas.module.js';

@Module({
  imports: [
    ConfiguracaoModule,
    DatabaseModule,
    AuthModule,
    UsuariosModule,
    EmpresaModule,
    ClientesModule,
    FornecedoresModule,
    ProdutosModule,
    EstoqueModule,
    VendasModule,
    CarnesModule,
    CaixaModule,
    RelatoriosModule,
  ],
  controllers: [SaudeController],
  providers: [
    // Ordem dos guards: primeiro autentica (JWT), depois confere o perfil.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: AdministradorGuard },
    { provide: APP_INTERCEPTOR, useClass: RespostaInterceptor },
    { provide: APP_FILTER, useClass: ExcecoesFilter },
  ],
})
export class AppModule {}
