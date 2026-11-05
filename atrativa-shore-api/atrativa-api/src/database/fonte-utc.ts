import { Logger } from '@nestjs/common';
import { DataSource, type DataSourceOptions } from 'typeorm';

export const SESSAO_UTC = "SET time_zone = '+00:00'";

interface ConexaoMysql {
  query: (sql: string, retorno: (erro: Error | null) => void) => unknown;
}

interface PoolMysql {
  on: (evento: 'connection', ouvinte: (conexao: ConexaoMysql) => void) => unknown;
}

const logger = new Logger('FusoPlataforma');

export async function iniciarFonteUtc(opcoes: DataSourceOptions): Promise<DataSource> {
  const fonte = new DataSource(opcoes);
  await fonte.initialize();
  const pool = (fonte.driver as unknown as { pool?: PoolMysql }).pool;
  pool?.on('connection', (conexao) => {
    conexao.query(SESSAO_UTC, (erro) => {
      if (erro) logger.error(`Não foi possível fixar o fuso UTC na conexão: ${erro.message}`);
    });
  });
  await fonte.query(SESSAO_UTC);
  return fonte;
}
