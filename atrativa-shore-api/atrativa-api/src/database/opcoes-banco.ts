import type { DataSourceOptions } from 'typeorm';
import type { Configuracao } from '../config/configuracao.js';
import { ENTIDADES_PLATAFORMA } from '../plataforma/entities/index.js';
import { MIGRATIONS_PLATAFORMA } from '../plataforma/migrations/index.js';
import { ENTIDADES } from './entidades.js';
import { MIGRATIONS } from './migrations/index.js';

function base(config: Configuracao, banco: string) {
  return {
    type: 'mysql' as const,
    host: config.banco.host,
    port: config.banco.porta,
    username: config.banco.usuario,
    password: config.banco.senha,
    database: banco,
    charset: config.banco.charset,
    dateStrings: true,
    synchronize: false,
    migrationsRun: false,
  };
}

export function opcoesBancoEmpresa(config: Configuracao, banco: string): DataSourceOptions {
  return {
    ...base(config, banco),
    logging: config.banco.log ? ['query', 'error'] : ['error'],
    entities: ENTIDADES,
    migrations: MIGRATIONS,
    migrationsTableName: 'api_migrations',
    extra: { connectionLimit: config.plataforma.conexoesPorEmpresa },
  };
}

export function opcoesBanco(config: Configuracao): DataSourceOptions {
  return opcoesBancoEmpresa(config, config.banco.nome);
}

export function opcoesPlataforma(config: Configuracao): DataSourceOptions {
  return {
    ...base(config, config.plataforma.banco),
    logging: config.banco.log ? ['query', 'error'] : ['error'],
    charset: 'utf8mb4',
    entities: ENTIDADES_PLATAFORMA,
    migrations: MIGRATIONS_PLATAFORMA,
    migrationsTableName: 'plataforma_migrations',
  };
}

export function opcoesServidor(config: Configuracao): DataSourceOptions {
  const { database: _banco, ...semBanco } = base(config, '');
  return { ...semBanco, logging: ['error'], entities: [], migrations: [] };
}
