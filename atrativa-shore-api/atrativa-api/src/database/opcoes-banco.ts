import type { DataSourceOptions } from 'typeorm';
import type { Configuracao } from '../config/configuracao.js';
import { ENTIDADES } from './entidades.js';
import { MIGRATIONS } from './migrations/index.js';

/**
 * Opções de conexão compartilhadas pela API e pelo script de migrations.
 *
 * synchronize e migrationsRun ficam SEMPRE desligados: o banco é legado e
 * compartilhado com o sistema desktop. Mudanças de estrutura só acontecem
 * por migration executada manualmente (npm run migration:run).
 */
export function opcoesBanco(config: Configuracao): DataSourceOptions {
  return {
    type: 'mysql',
    host: config.banco.host,
    port: config.banco.porta,
    username: config.banco.usuario,
    password: config.banco.senha,
    database: config.banco.nome,
    charset: config.banco.charset,
    // DATE volta como 'AAAA-MM-DD' (string), sem conversão de fuso horário.
    dateStrings: true,
    entities: ENTIDADES,
    migrations: MIGRATIONS,
    migrationsTableName: 'api_migrations',
    synchronize: false,
    migrationsRun: false,
    logging: config.banco.log ? ['query', 'error'] : ['error'],
  };
}
