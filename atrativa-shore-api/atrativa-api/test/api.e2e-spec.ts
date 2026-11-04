import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import bcrypt from 'bcrypt';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';

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
});
