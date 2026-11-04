import { HttpException, HttpStatus } from '@nestjs/common';

export class LimitadorTentativas {
  private readonly registros = new Map<string, number[]>();

  constructor(
    private readonly maximo: number,
    private readonly janelaMs: number,
  ) {}

  conferir(chave: string, mensagem: string): void {
    const agora = Date.now();
    const recentes = (this.registros.get(chave) ?? []).filter((instante) => agora - instante < this.janelaMs);
    if (recentes.length >= this.maximo) {
      this.registros.set(chave, recentes);
      throw new HttpException(mensagem, HttpStatus.TOO_MANY_REQUESTS);
    }
    recentes.push(agora);
    this.registros.set(chave, recentes);
    if (this.registros.size > 10_000) {
      for (const [outra, instantes] of this.registros) {
        if (instantes.every((instante) => agora - instante >= this.janelaMs)) this.registros.delete(outra);
      }
    }
  }

  limpar(chave: string): void {
    this.registros.delete(chave);
  }
}
