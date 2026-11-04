import { DataSource } from 'typeorm';
import { carregarConfiguracao } from '../config/configuracao.js';
import { opcoesBanco } from './opcoes-banco.js';

async function principal(): Promise<void> {
  try {
    process.loadEnvFile('.env');
  } catch {}

  const comando = process.argv[2];
  if (!['show', 'run', 'revert'].includes(comando ?? '')) {
    console.error('Uso: node dist/database/migrar.js <show|run|revert>');
    process.exitCode = 1;
    return;
  }

  const config = carregarConfiguracao();
  const fonte = new DataSource(opcoesBanco(config));
  await fonte.initialize();
  console.log(`Banco: ${config.banco.nome} em ${config.banco.host}:${config.banco.porta}`);

  try {
    if (comando === 'show') {
      const tabelaExiste =
        ((await fonte.query(
          "SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'api_migrations'",
        )) as unknown[]).length > 0;
      const registros = tabelaExiste
        ? ((await fonte.query('SELECT name FROM api_migrations')) as Array<{ name: string }>)
        : [];
      const executadas = new Set(registros.map((linha) => linha.name));
      for (const migration of fonte.migrations) {
        const nome = migration.name ?? migration.constructor.name;
        console.log(`${executadas.has(nome) ? '[x]' : '[ ]'} ${nome}`);
      }
    } else if (comando === 'run') {
      const aplicadas = await fonte.runMigrations({ transaction: 'each' });
      console.log(
        aplicadas.length
          ? `Aplicadas: ${aplicadas.map((m) => m.name).join(', ')}`
          : 'Nenhuma migration pendente.',
      );
    } else {
      await fonte.undoLastMigration({ transaction: 'each' });
      console.log('Última migration revertida.');
    }
  } finally {
    await fonte.destroy();
  }
}

principal().catch((erro: unknown) => {
  console.error(erro instanceof Error ? erro.message : erro);
  process.exitCode = 1;
});
