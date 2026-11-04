import type { DataSourceOptions } from 'typeorm';
import type { Configuracao } from '../config/configuracao.js';
import { ENTIDADES } from './entidades.js';
import { MIGRATIONS } from './migrations/index.js';

export function opcoesBanco(config: Configuracao): DataSourceOptions {
  return {
    type: 'mysql',
    host: config.banco.host,
    port: config.banco.porta,
    username: config.banco.usuario,
    password: config.banco.senha,
    database: config.banco.nome,
    charset: config.banco.charset,
    dateStrings: true,
    entities: ENTIDADES,
    migrations: MIGRATIONS,
    migrationsTableName: 'api_migrations',
    synchronize: false,
    migrationsRun: false,
    logging: config.banco.log ? ['query', 'error'] : ['error'],
  };
}
