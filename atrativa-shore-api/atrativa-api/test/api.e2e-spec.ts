import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createHash } from 'node:crypto';
import bcrypt from 'bcrypt';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { lerZip } from '../src/backup/ler-zip.js';

try {
  process.loadEnvFile('.env');
} catch {}

const habilitado = process.env.E2E_SAAS === 'true';
const marca = Date.now().toString(36);
const BANCO_PLATAFORMA = `e2e_plat_${marca}`;
const PREFIXO_EMPRESA = `e2e_${marca}_`;
const SUPERADMIN = { email: `dono-${marca}@e2e.test`, senha: 'senha-do-dono-e2e-123' };

if (habilitado) {
  process.env.DB_HOST = process.env.E2E_DB_HOST ?? process.env.DB_HOST;
  process.env.DB_PORT = process.env.E2E_DB_PORT ?? process.env.DB_PORT;
  process.env.DB_USERNAME = process.env.E2E_DB_USERNAME ?? process.env.DB_USERNAME;
  process.env.DB_PASSWORD = process.env.E2E_DB_PASSWORD ?? process.env.DB_PASSWORD;
  process.env.DB_PLATAFORMA = BANCO_PLATAFORMA;
  process.env.DB_EMPRESA_PREFIXO = PREFIXO_EMPRESA;
  process.env.EXIGIR_CAIXA_ABERTO = 'false';
  process.env.BCRYPT_ROUNDS = '8';
  process.env.JWT_SECRET ??= 'segredo-e2e-com-mais-de-trinta-e-dois-caracteres';
}

describe.skipIf(!habilitado)('Plataforma SaaS (e2e, MySQL real)', () => {
  let app: INestApplication<App>;
  let servidor: DataSource;
  const http = () => request(app.getHttpServer());
  const com = (token: string) => ({
    get: (url: string) => http().get(`/api/v1${url}`).set('Authorization', `Bearer ${token}`),
    post: (url: string) => http().post(`/api/v1${url}`).set('Authorization', `Bearer ${token}`),
    patch: (url: string) => http().patch(`/api/v1${url}`).set('Authorization', `Bearer ${token}`),
  });
  const entrar = async (login: string, senha: string) => {
    const resposta = await http().post('/api/v1/auth/login').send({ login, senha });
    return resposta;
  };

  let dono: ReturnType<typeof com>;
  let lojaA: ReturnType<typeof com>;
  let lojaB: ReturnType<typeof com>;
  let idEmpresaA = 0;

  beforeAll(async () => {
    const { carregarConfiguracao } = await import('../src/config/configuracao.js');
    const { opcoesPlataforma, opcoesServidor } = await import('../src/database/opcoes-banco.js');
    const config = carregarConfiguracao();
    servidor = new DataSource(opcoesServidor(config));
    await servidor.initialize();
    await servidor.query(`CREATE DATABASE \`${BANCO_PLATAFORMA}\` CHARACTER SET utf8mb4`);
    const plataforma = new DataSource(opcoesPlataforma(config));
    await plataforma.initialize();
    await plataforma.runMigrations();
    await plataforma.query(
      "INSERT INTO plataforma_usuarios (nome, email, senha_hash, papel, status) VALUES ('Dono', ?, ?, 'SUPER_ADMIN', 'ACTIVE')",
      [SUPERADMIN.email, await bcrypt.hash(SUPERADMIN.senha, 8)],
    );
    await plataforma.destroy();

    const { AppModule } = await import('../src/app.module.js');
    const { fabricaExcecaoValidacao } = await import('../src/common/validacao/mensagens-validacao.js');
    const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = modulo.createNestApplication({ logger: ['error'] });
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, exceptionFactory: fabricaExcecaoValidacao }),
    );
    await app.init();

    const login = await entrar(SUPERADMIN.email, SUPERADMIN.senha);
    expect(login.status).toBe(200);
    expect(login.body.data.usuario.papel).toBe('SUPER_ADMIN');
    dono = com(login.body.data.accessToken);
  }, 180_000);

  afterAll(async () => {
    await app?.close();
    if (servidor?.isInitialized) {
      const bancos = (await servidor.query('SELECT SCHEMA_NAME AS nome FROM information_schema.SCHEMATA WHERE SCHEMA_NAME LIKE ?', [
        `e2e_%${marca}%`,
      ])) as Array<{ nome: string }>;
      for (const { nome } of bancos) {
        if (nome === BANCO_PLATAFORMA || nome.startsWith(PREFIXO_EMPRESA)) await servidor.query(`DROP DATABASE \`${nome}\``);
      }
      await servidor.destroy();
    }
  }, 60_000);

  async function ativarNovaEmpresa(nome: string, email: string) {
    const gerado = await dono.post('/plataforma/codigos').send({ tipo: 'NOVA_EMPRESA' }).expect(201);
    const codigo: string = gerado.body.data.codigo;
    expect(codigo).toMatch(/^ATV-/);
    await http().post('/api/v1/ativacao/validar').send({ codigo }).expect(200);
    const ativado = await http()
      .post('/api/v1/ativacao/concluir')
      .send({ codigo, responsavel: { nome: `Admin ${nome}`, email, senha: 'senha-admin-e2e' }, empresa: { nome } })
      .expect(201);
    const login = await entrar(email, 'senha-admin-e2e');
    expect(login.status).toBe(200);
    expect(login.body.data.usuario).toMatchObject({ papel: 'COMPANY_ADMIN', empresa: { nome, status: 'ACTIVE' } });
    return { codigo, idEmpresa: ativado.body.data.empresa.id as number, cliente: com(login.body.data.accessToken) };
  }

  it('ativa duas empresas com códigos de uso único', { timeout: 180_000 }, async () => {
    const a = await ativarNovaEmpresa(`Loja A ${marca}`, `admin-a-${marca}@e2e.test`);
    const b = await ativarNovaEmpresa(`Loja B ${marca}`, `admin-b-${marca}@e2e.test`);
    lojaA = a.cliente;
    lojaB = b.cliente;
    idEmpresaA = a.idEmpresa;

    const reuso = await http().post('/api/v1/ativacao/validar').send({ codigo: a.codigo });
    expect(reuso.status).toBe(409);
    const invalido = await http().post('/api/v1/ativacao/validar').send({ codigo: 'ATV-00000-00000-00000-00000-00000' });
    expect(invalido.status).toBe(404);

    const revogavel = await dono.post('/plataforma/codigos').send({ tipo: 'NOVA_EMPRESA' }).expect(201);
    await dono.post(`/plataforma/codigos/${revogavel.body.data.id}/revogar`).expect(200);
    const revogado = await http().post('/api/v1/ativacao/validar').send({ codigo: revogavel.body.data.codigo });
    expect(revogado.status).toBe(410);

    const lista = await dono.get('/plataforma/codigos').expect(200);
    expect(JSON.stringify(lista.body)).not.toContain(a.codigo);
  });

  it('isola produtos, clientes e vendas entre as empresas', { timeout: 120_000 }, async () => {
    const produto = await lojaA
      .post('/produtos')
      .send({ nome: `CAMISETA EXCLUSIVA A ${marca}`, precoVista: 50, precoPrazo: 55 })
      .expect(201);
    await lojaA.post('/clientes').send({ nome: `CLIENTE SOMENTE A ${marca}` }).expect(201);
    await lojaB.post('/produtos').send({ nome: `CAMISETA EXCLUSIVA A ${marca}`, precoVista: 10 }).expect(201);

    const produtosB = await lojaB.get(`/produtos?busca=${marca}`).expect(200);
    expect(produtosB.body.meta.total).toBe(1);
    expect(produtosB.body.data[0].precoVista).toBe(10);

    const clientesB = await lojaB.get(`/clientes?busca=SOMENTE A ${marca}`).expect(200);
    expect(clientesB.body.meta.total).toBe(0);

    await lojaA.post('/estoque/entradas').send({ itens: [{ idProduto: produto.body.data.id, quantidade: 5, valorCompra: 20 }] }).expect(201);
    await lojaA
      .post('/vendas')
      .send({ itens: [{ idProduto: produto.body.data.id, quantidade: 1 }], pagamentos: [{ forma: 'DINHEIRO', valor: 55 }] })
      .expect(201);
    const vendasB = await lojaB.get('/vendas').expect(200);
    expect(vendasB.body.meta.total).toBe(0);
    const vendasA = await lojaA.get('/vendas').expect(200);
    expect(vendasA.body.meta.total).toBe(1);
  });

  it('bloqueia empresa nas rotas da plataforma', async () => {
    await lojaA.get('/plataforma/empresas').expect(403);
    await lojaA.post('/plataforma/codigos').send({ tipo: 'NOVA_EMPRESA' }).expect(403);
    await dono.get('/produtos').expect(403);
  });

  it('funcionário com senha temporária, permissões no backend e sem elevação de cargo', { timeout: 60_000 }, async () => {
    const criado = await lojaA
      .post('/funcionarios')
      .send({ nome: 'Vendedor E2E', login: `vend-${marca}`, papel: 'SELLER' })
      .expect(201);
    const senhaTemporaria: string = criado.body.data.senhaTemporaria;
    expect(senhaTemporaria).toHaveLength(12);

    const login = await entrar(`vend-${marca}`, senhaTemporaria);
    expect(login.body.data.usuario.trocarSenha).toBe(true);
    let vendedor = com(login.body.data.accessToken);
    await vendedor.get('/produtos').expect(403);
    const troca = await vendedor.patch('/auth/senha').send({ senhaAtual: senhaTemporaria, novaSenha: 'nova-senha-vendedor' }).expect(200);
    vendedor = com(troca.body.data.accessToken);

    await vendedor.get('/produtos').expect(200);
    await vendedor.post('/produtos').send({ nome: 'NAO PODE', precoVista: 1 }).expect(403);
    await vendedor.post(`/vendas/1/estorno`).expect(403);
    await vendedor.get('/funcionarios').expect(403);
    await vendedor.patch(`/funcionarios/${criado.body.data.funcionario.id}`).send({ papel: 'COMPANY_ADMIN' }).expect(403);

    const vendasDoVendedor = await vendedor.get('/vendas').expect(200);
    expect(vendasDoVendedor.body.meta.total).toBe(0);

    await lojaA.post(`/funcionarios/${criado.body.data.funcionario.id}/status`).send({ status: 'INACTIVE' }).expect(200);
    await vendedor.get('/produtos').expect(401);
    const bloqueado = await entrar(`vend-${marca}`, 'nova-senha-vendedor');
    expect(bloqueado.status).toBe(403);
  });

  it('suspende e reativa uma empresa sem perder dados', { timeout: 60_000 }, async () => {
    const empresas = await dono.get(`/plataforma/empresas?busca=Loja B ${marca}`).expect(200);
    const idB: number = empresas.body.data[0].id;
    await dono.post(`/plataforma/empresas/${idB}/status`).send({ status: 'SUSPENDED', motivo: 'teste' }).expect(200);
    await lojaB.get('/produtos').expect(403);
    const login = await entrar(`admin-b-${marca}@e2e.test`, 'senha-admin-e2e');
    expect(login.status).toBe(403);

    await dono.post(`/plataforma/empresas/${idB}/status`).send({ status: 'ACTIVE' }).expect(200);
    const novamente = await entrar(`admin-b-${marca}@e2e.test`, 'senha-admin-e2e');
    lojaB = com(novamente.body.data.accessToken);
    const produtos = await lojaB.get(`/produtos?busca=${marca}`).expect(200);
    expect(produtos.body.meta.total).toBe(1);
  });

  it('renova a sessão pelo cookie e detecta reutilização do refresh token', async () => {
    const login = await http()
      .post('/api/v1/auth/login')
      .send({ login: `admin-a-${marca}@e2e.test`, senha: 'senha-admin-e2e', lembrar: true })
      .expect(200);
    const cookie = login.headers['set-cookie'] as unknown as string[];
    expect(cookie[0]).toMatch(/HttpOnly/i);
    const renovado = await http().post('/api/v1/auth/refresh').set('Cookie', cookie).expect(200);
    expect(renovado.body.data.accessToken).toBeTruthy();
    await http().post('/api/v1/auth/refresh').set('Cookie', cookie).expect(401);
  });

  it('auditoria registra as operações e separa por empresa', async () => {
    const geral = await dono.get('/plataforma/auditoria?limit=100').expect(200);
    const acoes = geral.body.data.map((r: { acao: string }) => r.acao);
    expect(acoes).toEqual(expect.arrayContaining(['empresa.ativada', 'produto.criar', 'venda.registrar', 'plataforma.empresa_suspensa']));
    expect(JSON.stringify(geral.body)).not.toMatch(/senha-admin-e2e|nova-senha-vendedor/);

    const daLojaA = await lojaA.get('/auditoria?limit=100').expect(200);
    const empresas = new Set(daLojaA.body.data.map((r: { idEmpresa: number }) => r.idEmpresa));
    expect(empresas.size).toBe(1);
  });

  const binario = (resposta: request.Response, pronto: (erro: Error | null, corpo: unknown) => void) => {
    const fluxo = resposta as unknown as NodeJS.ReadableStream;
    const partes: Buffer[] = [];
    fluxo.on('data', (parte: Buffer) => partes.push(parte));
    fluxo.on('end', () => pronto(null, Buffer.concat(partes)));
  };

  async function aguardarBackup(cliente: ReturnType<typeof com>, base: string, id: number) {
    for (let tentativa = 0; tentativa < 120; tentativa += 1) {
      const atual = await cliente.get(`${base}/${id}`).expect(200);
      if (atual.body.data.status !== 'PROCESSANDO') return atual.body.data as { status: string; nomeArquivo: string; sha256: string; erro: string | null };
      await new Promise((resolver) => setTimeout(resolver, 500));
    }
    throw new Error('Backup não terminou a tempo');
  }

  it('fecha o caixa, gera o backup da empresa e baixa um ZIP só com os dados dela', { timeout: 120_000 }, async () => {
    await lojaA.post('/caixa/abrir').send({ valorAbertura: 50 }).expect(201);
    const fechado = await lojaA.post('/caixa/fechar').send({}).expect(200);
    const historicoAntes = await lojaA.get('/caixa/historico').expect(200);

    const pedido = await lojaA.post('/backups').expect(202);
    expect(pedido.body.data).toMatchObject({ tipo: 'EMPRESA', status: 'PROCESSANDO' });
    const id: number = pedido.body.data.id;
    const pronto = await aguardarBackup(lojaA, '/backups', id);
    expect(pronto.status).toBe('CONCLUIDO');
    expect(pronto.nomeArquivo).toMatch(new RegExp(`^atrativa-shore-backup-loja-a-${marca}-\\d{4}-\\d{2}-\\d{2}\\.zip$`));

    const download = await lojaA.get(`/backups/${id}/download`).buffer(true).parse(binario).expect(200);
    expect(download.headers['content-type']).toBe('application/zip');
    expect(download.headers['content-disposition']).toContain(`filename="${pronto.nomeArquivo}"`);
    const zip = download.body as Buffer;
    expect(createHash('sha256').update(zip).digest('hex')).toBe(pronto.sha256);
    const entradas = lerZip(zip);
    const texto = (nome: string) => entradas.get(nome)!.conteudo.toString('utf8');

    const metadados = JSON.parse(texto('metadados.json'));
    expect(metadados).toMatchObject({ formato: 'atrativa-shore-backup-empresa', versaoFormato: 2, empresa: { id: idEmpresaA } });
    const sql = texto('dados/empresa.sql');
    expect(sql).toMatch(/CREATE TABLE `cad_produtos`/);
    expect(sql.split(`CAMISETA EXCLUSIVA A ${marca}`).length - 1).toBe(1);
    expect(sql).toContain(`CLIENTE SOMENTE A ${marca}`);
    expect(sql).toMatch(/INSERT INTO `mv_fechamento`/);
    expect(sql).not.toMatch(/INSERT INTO `api_credencial`|DROP TABLE/);
    const central = texto('dados/plataforma.sql');
    expect(central).toContain(`admin-a-${marca}@e2e.test`);
    expect(central).not.toContain(`admin-b-${marca}@e2e.test`);
    expect(entradas.has('empresa.json')).toBe(true);
    const todo = [...entradas.values()].map((e) => e.conteudo.toString('utf8')).join('\n');
    expect(todo).not.toMatch(/senha-admin-e2e|nova-senha-vendedor|\$2[aby]\$/);
    expect(todo).not.toContain(`Loja B ${marca}`);

    const historicoDepois = await lojaA.get('/caixa/historico').expect(200);
    expect(historicoDepois.body).toEqual(historicoAntes.body);
    expect(fechado.body.data.resumo).toBeTruthy();

    const lista = await lojaA.get('/backups').expect(200);
    expect(lista.body.data[0]).toMatchObject({ id, status: 'CONCLUIDO', downloads: 1, disponivel: true });
  });

  it('impede outra empresa, funcionários sem permissão e o superadministrador de usar o backup da empresa', { timeout: 60_000 }, async () => {
    const lista = await lojaA.get('/backups').expect(200);
    const id: number = lista.body.data[0].id;
    await lojaB.get(`/backups/${id}`).expect(404);
    await lojaB.get(`/backups/${id}/download`).expect(404);
    expect((await lojaB.get('/backups').expect(200)).body.meta.total).toBe(0);
    await http().get(`/api/v1/backups/${id}/download`).expect(401);
    await dono.post('/backups').expect(403);
    await dono.get(`/plataforma/backups/${id}`).expect(404);
    await lojaA.post('/plataforma/backups').expect(403);

    const criado = await lojaA.post('/funcionarios').send({ nome: 'Gerente E2E', login: `ger-${marca}`, papel: 'MANAGER' }).expect(201);
    const login = await entrar(`ger-${marca}`, criado.body.data.senhaTemporaria);
    const troca = await com(login.body.data.accessToken)
      .patch('/auth/senha')
      .send({ senhaAtual: criado.body.data.senhaTemporaria, novaSenha: 'nova-senha-gerente' })
      .expect(200);
    const gerente = com(troca.body.data.accessToken);
    await gerente.post('/backups').expect(403);
    await gerente.get(`/backups/${id}/download`).expect(403);
  });

  it('gera o backup global apenas para o superadministrador, com todos os bancos', { timeout: 120_000 }, async () => {
    const pedido = await dono.post('/plataforma/backups').expect(202);
    const pronto = await aguardarBackup(dono, '/plataforma/backups', pedido.body.data.id);
    expect(pronto.status).toBe('CONCLUIDO');
    const download = await dono.get(`/plataforma/backups/${pedido.body.data.id}/download`).buffer(true).parse(binario).expect(200);
    const entradas = lerZip(download.body as Buffer);
    const arquivos = [...entradas.keys()];
    const completo = entradas.get('sql/plataforma-completa.sql')?.conteudo.toString('utf8');
    if (completo) {
      expect(completo).toContain(`CREATE DATABASE /*!32312 IF NOT EXISTS*/ \`${BANCO_PLATAFORMA}\``);
      expect(completo.match(new RegExp(`CREATE DATABASE .*\`${PREFIXO_EMPRESA}`, 'g'))).toHaveLength(2);
      expect(completo).not.toMatch(/INSERT INTO `plataforma_refresh_tokens`/);
    } else {
      expect(arquivos).toContain(`sql/${BANCO_PLATAFORMA}.sql`);
      expect(arquivos.filter((a) => a.startsWith(`sql/${PREFIXO_EMPRESA}`))).toHaveLength(2);
      const central = entradas.get(`sql/${BANCO_PLATAFORMA}.sql`)!.conteudo.toString('utf8');
      expect(central).toContain('CREATE TABLE `plataforma_empresas`');
      expect(central).not.toMatch(/INSERT INTO `plataforma_refresh_tokens`/);
    }
    expect((await lojaA.get('/backups').expect(200)).body.data.every((b: { tipo: string }) => b.tipo === 'EMPRESA')).toBe(true);

    const auditoria = await dono.get('/plataforma/auditoria?acao=backup.&limit=100').expect(200);
    const acoes = auditoria.body.data.map((r: { acao: string }) => r.acao);
    expect(acoes).toEqual(expect.arrayContaining(['backup.gerado', 'backup.baixado']));
  });
});
