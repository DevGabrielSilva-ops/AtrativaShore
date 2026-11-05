import { Ativacao } from './ativacao.entity.js';
import { Backup } from './backup.entity.js';
import { RegistroAuditoria } from './auditoria.entity.js';
import { Cargo } from './cargo.entity.js';
import { CodigoAtivacao } from './codigo-ativacao.entity.js';
import { Importacao } from './importacao.entity.js';
import { PlataformaEmpresa } from './empresa-plataforma.entity.js';
import { Plano } from './plano.entity.js';
import { RefreshToken } from './refresh-token.entity.js';
import { PlataformaUsuario } from './usuario-plataforma.entity.js';

export const ENTIDADES_PLATAFORMA = [
  Plano,
  PlataformaEmpresa,
  PlataformaUsuario,
  Cargo,
  CodigoAtivacao,
  Ativacao,
  RefreshToken,
  RegistroAuditoria,
  Backup,
  Importacao,
];

export { Ativacao, Backup, Cargo, CodigoAtivacao, Importacao, Plano, PlataformaEmpresa, PlataformaUsuario, RefreshToken, RegistroAuditoria };
export type { StatusBackup, TipoBackup } from './backup.entity.js';
export type { StatusImportacao } from './importacao.entity.js';
