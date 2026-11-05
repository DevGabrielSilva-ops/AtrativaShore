import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AcessoGuard } from './acesso/acesso.guard.js';
import { AtivacaoModule } from './ativacao/ativacao.module.js';
import { AuditoriaInterceptor } from './auditoria/auditoria.interceptor.js';
import { AuditoriaModule } from './auditoria/auditoria.module.js';
import { AuthModule } from './auth/auth.module.js';
import { BackupsModule } from './backup/backups.module.js';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard.js';
import { CaixaModule } from './caixa/caixa.module.js';
import { CarnesModule } from './carnes/carnes.module.js';
import { ClientesModule } from './clientes/clientes.module.js';
import { ExcecoesFilter } from './common/filters/excecoes.filter.js';
import { RespostaInterceptor } from './common/interceptors/resposta.interceptor.js';
import { ConfiguracaoModule } from './config/configuracao.module.js';
import { DatabaseModule } from './database/database.module.js';
import { EmpresaModule } from './empresa/empresa.module.js';
import { EstoqueModule } from './estoque/estoque.module.js';
import { FornecedoresModule } from './fornecedores/fornecedores.module.js';
import { FuncionariosModule } from './funcionarios/funcionarios.module.js';
import { PlataformaModule } from './plataforma/admin/plataforma.module.js';
import { ProdutosModule } from './produtos/produtos.module.js';
import { RelatoriosModule } from './relatorios/relatorios.module.js';
import { SaudeController } from './saude/saude.controller.js';
import { ContextoInterceptor } from './tenancy/contexto.interceptor.js';
import { VendasModule } from './vendas/vendas.module.js';

@Module({
  imports: [
    ConfiguracaoModule,
    DatabaseModule,
    AuthModule,
    AuditoriaModule,
    FuncionariosModule,
    AtivacaoModule,
    PlataformaModule,
    EmpresaModule,
    ClientesModule,
    FornecedoresModule,
    ProdutosModule,
    EstoqueModule,
    VendasModule,
    CarnesModule,
    CaixaModule,
    RelatoriosModule,
    BackupsModule,
  ],
  controllers: [SaudeController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: AcessoGuard },
    { provide: APP_INTERCEPTOR, useClass: ContextoInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuditoriaInterceptor },
    { provide: APP_INTERCEPTOR, useClass: RespostaInterceptor },
    { provide: APP_FILTER, useClass: ExcecoesFilter },
  ],
})
export class AppModule {}
