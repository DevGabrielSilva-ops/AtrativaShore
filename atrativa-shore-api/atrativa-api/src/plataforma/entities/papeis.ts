export const PAPEIS = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'MANAGER', 'SELLER', 'STOCK_OPERATOR'] as const;
export type Papel = (typeof PAPEIS)[number];

export const PAPEIS_EMPRESA = ['COMPANY_ADMIN', 'MANAGER', 'SELLER', 'STOCK_OPERATOR'] as const;
export type PapelEmpresa = (typeof PAPEIS_EMPRESA)[number];

export const STATUS_EMPRESA = ['PENDING', 'ACTIVE', 'SUSPENDED', 'EXPIRED'] as const;
export type StatusEmpresa = (typeof STATUS_EMPRESA)[number];

export const STATUS_USUARIO = ['ACTIVE', 'INACTIVE'] as const;
export type StatusUsuario = (typeof STATUS_USUARIO)[number];

export const TIPOS_CODIGO = ['NOVA_EMPRESA', 'EMPRESA_EXISTENTE'] as const;
export type TipoCodigo = (typeof TIPOS_CODIGO)[number];
