import { Ativacao } from './ativacao.entity.js';
import { Backup } from './backup.entity.js';
import { RegistroAuditoria } from './auditoria.entity.js';
import { Cargo } from './cargo.entity.js';
import { CodigoAtivacao } from './codigo-ativacao.entity.js';
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
];

export { Ativacao, Backup, Cargo, CodigoAtivacao, Plano, PlataformaEmpresa, PlataformaUsuario, RefreshToken, RegistroAuditoria };
export type { StatusBackup, TipoBackup } from './backup.entity.js';
