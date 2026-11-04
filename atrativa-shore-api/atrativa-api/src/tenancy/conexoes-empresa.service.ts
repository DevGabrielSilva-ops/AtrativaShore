import { Injectable, Logger, type OnApplicationShutdown } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ConfiguracaoService } from '../config/configuracao.service.js';
import { opcoesBancoEmpresa } from '../database/opcoes-banco.js';

@Injectable()
export class ConexoesEmpresaService implements OnApplicationShutdown {
  private readonly logger = new Logger('ConexoesEmpresa');
  private readonly fontes = new Map<string, Promise<DataSource>>();

  constructor(private readonly config: ConfiguracaoService) {}

  obter(banco: string): Promise<DataSource> {
    let fonte = this.fontes.get(banco);
    if (!fonte) {
      fonte = new DataSource(opcoesBancoEmpresa(this.config.valores, banco)).initialize();
      fonte.catch(() => this.fontes.delete(banco));
      this.fontes.set(banco, fonte);
    }
    return fonte;
  }

  async fechar(banco: string): Promise<void> {
    const fonte = this.fontes.get(banco);
    this.fontes.delete(banco);
    if (fonte) await (await fonte).destroy().catch(() => undefined);
  }

  async onApplicationShutdown(): Promise<void> {
    const todas = [...this.fontes.values()];
    this.fontes.clear();
    for (const fonte of todas) {
      try {
        await (await fonte).destroy();
      } catch (erro) {
        this.logger.warn(`Falha ao fechar conexão: ${(erro as Error).message}`);
      }
    }
  }
}
