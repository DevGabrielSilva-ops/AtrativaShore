import { Injectable } from '@nestjs/common';
import { carregarConfiguracao, type Configuracao } from './configuracao.js';

@Injectable()
export class ConfiguracaoService {
  readonly valores: Configuracao = carregarConfiguracao();

  get pdv() {
    return this.valores.pdv;
  }

  get fusoHorario(): string {
    return this.valores.fusoHorario;
  }

  get empresaId(): number {
    return this.valores.empresaId;
  }
}
