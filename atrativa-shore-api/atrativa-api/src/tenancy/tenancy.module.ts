import { Global, Module } from '@nestjs/common';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { ENTIDADES } from '../database/entidades.js';
import { ConexoesEmpresaService } from './conexoes-empresa.service.js';
import { fonteDaEmpresa, proxyDoContexto } from './contexto.js';
import { ProvisionamentoService } from './provisionamento.service.js';

const fonteProxy = proxyDoContexto(() => fonteDaEmpresa());

const repositorios = ENTIDADES.map((entidade) => ({
  provide: getRepositoryToken(entidade),
  useValue: proxyDoContexto(() => fonteDaEmpresa().getRepository(entidade)),
}));

@Global()
@Module({
  providers: [
    ConexoesEmpresaService,
    ProvisionamentoService,
    { provide: getDataSourceToken(), useValue: fonteProxy },
    ...repositorios,
  ],
  exports: [ConexoesEmpresaService, ProvisionamentoService, getDataSourceToken(), ...repositorios.map((r) => r.provide)],
})
export class TenancyModule {}
