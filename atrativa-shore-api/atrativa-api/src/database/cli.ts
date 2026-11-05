import { parseArgs } from 'node:util';
import bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import { carregarConfiguracao, type Configuracao } from '../config/configuracao.js';
import { PERFIL_ACESSO_WEB, bancoExiste, migrarBancoEmpresa, nomeBancoValido } from '../tenancy/provisionamento.js';
import { iniciarFonteUtc } from './fonte-utc.js';
import { opcoesBancoEmpresa, opcoesPlataforma, opcoesServidor } from './opcoes-banco.js';

type Comando = (config: Configuracao, argumentos: string[]) => Promise<void>;

async function comPlataforma<T>(config: Configuracao, acao: (fonte: DataSource) => Promise<T>): Promise<T> {
  const fonte = await iniciarFonteUtc(opcoesPlataforma(config));
  try {
    return await acao(fonte);
  } finally {
    await fonte.destroy();
  }
}

const plataformaMigrar: Comando = async (config) => {
  const servidor = new DataSource(opcoesServidor(config));
  await servidor.initialize();
  try {
    const { existe } = await bancoExiste(servidor, config.plataforma.banco);
    if (!existe) {
      await servidor.query(
        `CREATE DATABASE \`${config.plataforma.banco}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
      );
      console.log(`Banco ${config.plataforma.banco} criado.`);
    }
  } finally {
    await servidor.destroy();
  }
  await comPlataforma(config, async (fonte) => {
    const aplicadas = await fonte.runMigrations({ transaction: 'each' });
    console.log(aplicadas.length ? `Aplicadas: ${aplicadas.map((m) => m.name).join(', ')}` : 'Plataforma já está atualizada.');
  });
};

const empresasMigrar: Comando = async (config) => {
  const empresas = await comPlataforma(
    config,
    (fonte) =>
      fonte.query('SELECT id, nome, banco FROM plataforma_empresas WHERE banco_provisionado = 1 ORDER BY id') as Promise<
        Array<{ id: number; nome: string; banco: string }>
      >,
  );
  if (empresas.length === 0) console.log('Nenhuma empresa com banco provisionado.');
  for (const empresa of empresas) {
    const aplicadas = await migrarBancoEmpresa(config, empresa.banco);
    console.log(`#${empresa.id} ${empresa.nome} (${empresa.banco}): ${aplicadas.length ? aplicadas.join(', ') : 'atualizado'}`);
  }
};

const superadmin: Comando = async (config, argumentos) => {
  const email = process.env.SUPERADMIN_EMAIL?.trim().toLowerCase();
  const senha = process.env.SUPERADMIN_SENHA ?? '';
  const nome = process.env.SUPERADMIN_NOME?.trim() || 'Administrador da plataforma';
  const redefinir = argumentos.includes('--redefinir-senha');
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Defina SUPERADMIN_EMAIL com um e-mail válido');
  if (senha.length < 12) throw new Error('Defina SUPERADMIN_SENHA com pelo menos 12 caracteres');
  const senhaHash = await bcrypt.hash(senha, config.bcryptRodadas);
  await comPlataforma(config, async (fonte) => {
    const [existente] = (await fonte.query('SELECT id, papel FROM plataforma_usuarios WHERE email = ?', [email])) as Array<{
      id: number;
      papel: string;
    }>;
    if (existente) {
      if (existente.papel !== 'SUPER_ADMIN') throw new Error('Este e-mail já pertence a um usuário de empresa');
      if (!redefinir) {
        console.log(`Superadministrador ${email} já existe. Use --redefinir-senha para trocar a senha.`);
        return;
      }
      await fonte.query(
        "UPDATE plataforma_usuarios SET senha_hash = ?, status = 'ACTIVE', trocar_senha = 0, versao_token = versao_token + 1 WHERE id = ?",
        [senhaHash, existente.id],
      );
      await fonte.query('UPDATE plataforma_refresh_tokens SET revogado_em = NOW() WHERE id_usuario = ? AND revogado_em IS NULL', [
        existente.id,
      ]);
      await fonte.query("INSERT INTO plataforma_auditoria (id_usuario, acao, entidade, id_entidade) VALUES (?, 'cli.superadmin_senha', 'usuario', ?)", [
        existente.id,
        String(existente.id),
      ]);
      console.log(`Senha do superadministrador ${email} redefinida.`);
      return;
    }
    const resultado = (await fonte.query(
      "INSERT INTO plataforma_usuarios (nome, email, senha_hash, papel, status) VALUES (?, ?, ?, 'SUPER_ADMIN', 'ACTIVE')",
      [nome, email, senhaHash],
    )) as { insertId: number };
    await fonte.query("INSERT INTO plataforma_auditoria (id_usuario, acao, entidade, id_entidade) VALUES (?, 'cli.superadmin_criado', 'usuario', ?)", [
      resultado.insertId,
      String(resultado.insertId),
    ]);
    console.log(`Superadministrador ${email} criado.`);
  });
};

function papelDoPerfilLegado(nomePerfil: string | null): string {
  return nomePerfil?.trim().toUpperCase() === 'ADMINISTRADOR' ? 'COMPANY_ADMIN' : 'SELLER';
}

const importar: Comando = async (config, argumentos) => {
  const banco = argumentos[0] ?? config.banco.nome;
  if (!nomeBancoValido(banco)) throw new Error(`Nome de banco inválido: ${banco}`);
  console.log(`Importando o banco ${banco} como empresa da plataforma...`);

  const servidor = new DataSource(opcoesServidor(config));
  await servidor.initialize();
  const estado = await bancoExiste(servidor, banco).finally(() => servidor.destroy());
  if (estado.tabelas === 0) throw new Error(`O banco ${banco} não existe ou está vazio. Importe o dump antes.`);

  const migradas = await migrarBancoEmpresa(config, banco);
  if (migradas.length) console.log(`Migrations aplicadas no banco da empresa: ${migradas.join(', ')}`);

  const empresaBanco = new DataSource(opcoesBancoEmpresa(config, banco));
  await empresaBanco.initialize();
  try {
    const [cadastro] = (await empresaBanco.query(
      'SELECT nome_empresa, cnpj, email, telefone, cidade, uf FROM cad_empresa ORDER BY id LIMIT 1',
    )) as Array<Record<string, string | null>>;
    const usuariosLegados = (await empresaBanco.query(
      `SELECT l.id, l.login, p.nome_perfil FROM cad_login l
         LEFT JOIN cad_login_perfil p ON p.id_perfil = l.id_perfil
        WHERE p.nome_perfil IS NULL OR p.nome_perfil <> ?
        ORDER BY l.id`,
      [PERFIL_ACESSO_WEB],
    )) as Array<{ id: number; login: string | null; nome_perfil: string | null }>;

    await comPlataforma(config, async (fonte) => {
      const [jaExiste] = (await fonte.query('SELECT id FROM plataforma_empresas WHERE banco = ?', [banco])) as Array<{ id: number }>;
      if (jaExiste) {
        console.log(`O banco ${banco} já está registrado como empresa #${jaExiste.id}. Nada a fazer.`);
        return;
      }
      await fonte.transaction(async (manager) => {
        const [plano] = (await manager.query('SELECT id FROM plataforma_planos WHERE ativo = 1 ORDER BY id LIMIT 1')) as Array<{
          id: number;
        }>;
        const nome = (argumentos[1] ?? cadastro?.nome_empresa ?? banco).trim().slice(0, 100);
        const empresa = (await manager.query(
          `INSERT INTO plataforma_empresas (nome, cnpj, email, telefone, cidade, uf, status, id_plano, banco, banco_provisionado, ativada_em, motivo_status)
           VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, 1, NOW(), 'Importada do sistema anterior')`,
          [
            nome,
            cadastro?.cnpj ?? null,
            cadastro?.email?.toLowerCase() ?? null,
            cadastro?.telefone ?? null,
            cadastro?.cidade ?? null,
            cadastro?.uf ?? null,
            plano?.id ?? null,
            banco,
          ],
        )) as { insertId: number };
        console.log(`Empresa #${empresa.insertId} "${nome}" registrada.`);

        for (const legado of usuariosLegados) {
          const base = (legado.login ?? `USUARIO${legado.id}`).trim().slice(0, 30);
          const [ocupado] = (await manager.query('SELECT id FROM plataforma_usuarios WHERE login = ?', [base])) as unknown[];
          const login = ocupado ? `${base}.${empresa.insertId}` : base;
          const papel = papelDoPerfilLegado(legado.nome_perfil);
          const [credencial] = (await empresaBanco
            .query('SELECT senha_hash FROM api_credencial WHERE id_login = ?', [legado.id])
            .catch(() => [])) as Array<{ senha_hash: string }>;
          const usuario = (await manager.query(
            `INSERT INTO plataforma_usuarios (id_empresa, nome, login, senha_hash, papel, status, id_login_legado)
             VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?)`,
            [empresa.insertId, base, login, credencial?.senha_hash ?? null, papel, legado.id],
          )) as { insertId: number };
          console.log(
            `  Usuário ${login} (${papel})${ocupado ? ' — login já existia na plataforma, sufixo adicionado' : ''}` +
              `${credencial ? '' : ' — a senha do sistema anterior vale no primeiro acesso'}`,
          );
          await manager.query(
            "INSERT INTO plataforma_auditoria (id_usuario, id_empresa, acao, entidade, id_entidade) VALUES (?, ?, 'cli.usuario_importado', 'usuario', ?)",
            [usuario.insertId, empresa.insertId, String(usuario.insertId)],
          );
        }
        await manager.query(
          "INSERT INTO plataforma_auditoria (id_empresa, acao, entidade, id_entidade, detalhes) VALUES (?, 'cli.empresa_importada', 'empresa', ?, ?)",
          [empresa.insertId, String(empresa.insertId), JSON.stringify({ banco, usuarios: usuariosLegados.length })],
        );
      });
    });
  } finally {
    await empresaBanco.destroy();
  }
};

const COMANDOS: Record<string, Comando> = {
  'plataforma-migrar': plataformaMigrar,
  'empresas-migrar': empresasMigrar,
  superadmin,
  importar,
};

async function principal(): Promise<void> {
  try {
    process.loadEnvFile('.env');
  } catch {}
  const { positionals } = parseArgs({ allowPositionals: true, strict: false });
  const [nome, ...argumentos] = positionals;
  const comando = nome ? COMANDOS[nome] : undefined;
  if (!comando) {
    console.error(`Uso: node dist/database/cli.js <${Object.keys(COMANDOS).join('|')}> [argumentos]`);
    process.exitCode = 1;
    return;
  }
  await comando(carregarConfiguracao(), [...argumentos, ...process.argv.filter((a) => a.startsWith('--'))]);
}

principal().catch((erro: unknown) => {
  console.error(erro instanceof Error ? erro.message : erro);
  process.exitCode = 1;
});
