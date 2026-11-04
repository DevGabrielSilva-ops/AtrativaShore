import { SetMetadata } from '@nestjs/common';

export const CHAVE_AUDITAR = 'auditoria:acao';

export interface ConfiguracaoAuditoria {
  acao: string;
  entidade: string;
}

export const Auditar = (acao: string, entidade: string) =>
  SetMetadata(CHAVE_AUDITAR, { acao, entidade } satisfies ConfiguracaoAuditoria);
