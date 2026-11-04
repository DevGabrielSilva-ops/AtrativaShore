import { Injectable } from '@nestjs/common';
import { ConfiguracaoService } from '../config/configuracao.service.js';
import { ConexoesEmpresaService } from './conexoes-empresa.service.js';
import { criarLoginEspelho, type DadosCadastroEmpresa, provisionarBancoEmpresa } from './provisionamento.js';

@Injectable()
export class ProvisionamentoService {
  constructor(
    private readonly config: ConfiguracaoService,
    private readonly conexoes: ConexoesEmpresaService,
  ) {}

  nomeDoBanco(idEmpresa: number): string {
    return `${this.config.valores.plataforma.prefixoBancoEmpresa}${idEmpresa}`;
  }

  async provisionar(banco: string, dados: DadosCadastroEmpresa): Promise<void> {
    await this.conexoes.fechar(banco);
    await provisionarBancoEmpresa(this.config.valores, banco, dados);
  }

  async criarLoginEspelho(banco: string, referencia: string): Promise<number> {
    const fonte = await this.conexoes.obter(banco);
    return criarLoginEspelho(fonte, referencia);
  }
}
