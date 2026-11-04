/**
 * Teste de ponta a ponta contra um MySQL REAL de teste.
 *
 * Pré-requisitos (ver README, seção "Testes"):
 *  1. banco de teste separado com o dump importado (npm run db:converter-dump);
 *  2. migrations aplicadas nesse banco;
 *  3. variáveis E2E_DB_* apontando para ele.
 *
 * Grava registros de teste (cliente, produto, nota, vendas). Por segurança,
 * só roda se E2E_DB_DATABASE estiver definido e for diferente de DB_DATABASE.
 */
import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';

try {
  process.loadEnvFile('.env');
} catch {
  // sem .env: usa o ambiente
}

const bancoTeste = process.env.E2E_DB_DATABASE;
const habilitado = Boolean(bancoTeste) && bancoTeste !== process.env.DB_DATABASE;

if (habilitado) {
  process.env.DB_HOST = process.env.E2E_DB_HOST ?? process.env.DB_HOST;
  process.env.DB_PORT = process.env.E2E_DB_PORT ?? process.env.DB_PORT;
  process.env.DB_USERNAME = process.env.E2E_DB_USERNAME ?? process.env.DB_USERNAME;
  process.env.DB_PASSWORD = process.env.E2E_DB_PASSWORD ?? process.env.DB_PASSWORD;
  process.env.DB_DATABASE = bancoTeste;
  process.env.PDV_TERMINAL = process.env.E2E_PDV_TERMINAL ?? '99';
  process.env.JWT_SECRET ??= 'segredo-e2e-com-mais-de-trinta-e-dois-caracteres';
}

describe.skipIf(!habilitado)('API Atrativa Shore (e2e, MySQL de teste)', () => {
  let app: INestApplication<App>;
  let token: string;
  const sufixo = Date.now().toString().slice(-8);
  const http = () => request(app.getHttpServer());
  const autenticado = (metodo: 'get' | 'post' | 'patch' | 'delete', url: string) =>
    http()[metodo](`/api/v1${url}`).set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    const { AppModule } = await import('../src/app.module.js');
    const { ExcecoesFilter } = await import('../src/common/filters/excecoes.filter.js');
    const { fabricaExcecaoValidacao } = await import('../src/common/validacao/mensagens-validacao.js');
    const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = modulo.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, exceptionFactory: fabricaExcecaoValidacao }),
    );
    app.useGlobalFilters(new ExcecoesFilter());
    await app.init();

    const login = await http()
      .post('/api/v1/auth/login')
      .send({ login: process.env.E2E_LOGIN ?? 'ATRATIVA', senha: process.env.E2E_SENHA ?? '' })
      .expect(200);
    token = login.body.data.accessToken;

    const caixa = await autenticado('get', '/caixa/atual').expect(200);
    if (!caixa.body.data) await autenticado('post', '/caixa/abrir').send({ valorAbertura: 0 }).expect(201);
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  it('exige autenticação nas rotas privadas', async () => {
    await http().get('/api/v1/clientes').expect(401);
    const resposta = await http().post('/api/v1/auth/login').send({ login: 'ATRATIVA', senha: 'senha-errada' });
    expect(resposta.status).toBe(401);
    expect(resposta.body).toMatchObject({ statusCode: 401, path: '/api/v1/auth/login' });
  });

  it('valida dados de entrada com mensagens em português', async () => {
    const resposta = await autenticado('post', '/clientes').send({ nome: '', cpf: '123' }).expect(400);
    expect(resposta.body.message).toEqual(expect.arrayContaining(['nome é obrigatório']));
  });

  it('fluxo completo: cadastro, entrada, venda, estoque insuficiente, estorno, carnê e relatórios', { timeout: 120_000 }, async () => {
    const cliente = await autenticado('post', '/clientes').send({ nome: `CLIENTE E2E ${sufixo}` }).expect(201);
    const idCliente: number = cliente.body.data.id;
    expect(cliente.body.data.codigo).toMatch(/^1\d{12}$/);

    const busca = await autenticado('get', `/clientes?busca=E2E ${sufixo}`).expect(200);
    expect(busca.body.meta.total).toBe(1);

    const produto = await autenticado('post', '/produtos')
      .send({ nome: `PRODUTO E2E ${sufixo}`, precoVista: 25, precoPrazo: 30, valorCompra: 10 })
      .expect(201);
    const idProduto: number = produto.body.data.id;
    expect(produto.body.data).toMatchObject({ quantidadeEstoque: 0, lucroBrutoPercentual: 150 });

    await autenticado('post', '/estoque/entradas')
      .send({ itens: [{ idProduto, quantidade: 5, valorCompra: 10 }] })
      .expect(201);
    expect((await autenticado('get', `/produtos/${idProduto}`)).body.data.quantidadeEstoque).toBe(5);

    // Venda: preço sugerido = a prazo (30,00); total calculado pela API.
    const venda = await autenticado('post', '/vendas')
      .send({ itens: [{ idProduto, quantidade: 2 }], pagamentos: [{ forma: 'DINHEIRO', valor: 60 }] })
      .expect(201);
    expect(venda.body.data).toMatchObject({ total: 60, formasPagamento: ['Dinheiro'] });
    expect((await autenticado('get', `/produtos/${idProduto}`)).body.data.quantidadeEstoque).toBe(3);

    // Estoque insuficiente: 409 e nada é gravado.
    const antes = (await autenticado('get', `/vendas?idCliente=0&limit=1`)).body.meta.total;
    await autenticado('post', '/vendas')
      .send({ itens: [{ idProduto, quantidade: 10 }], pagamentos: [{ forma: 'DINHEIRO', valor: 300 }] })
      .expect(409);
    expect((await autenticado('get', `/vendas?idCliente=0&limit=1`)).body.meta.total).toBe(antes);
    expect((await autenticado('get', `/produtos/${idProduto}`)).body.data.quantidadeEstoque).toBe(3);

    // Total enviado errado: 400.
    await autenticado('post', '/vendas')
      .send({ itens: [{ idProduto, quantidade: 1 }], pagamentos: [{ forma: 'DINHEIRO', valor: 1 }] })
      .expect(400);

    // Estorno devolve o estoque.
    await autenticado('post', `/vendas/${venda.body.data.id}/estorno`).expect(200);
    expect((await autenticado('get', `/produtos/${idProduto}`)).body.data.quantidadeEstoque).toBe(5);

    // Carnê em 3 parcelas e baixa da primeira.
    const carne = await autenticado('post', '/vendas')
      .send({
        idCliente,
        itens: [{ idProduto, quantidade: 1, precoUnitario: 119 }],
        pagamentos: [{ forma: 'CARNE', valor: 119 }],
        parcelasCarne: 3,
      })
      .expect(201);
    expect(carne.body.data.parcelasCarne.map((p: { valor: number }) => p.valor)).toEqual([39.67, 39.67, 39.66]);
    const abertas = await autenticado('get', `/carnes?idCliente=${idCliente}`).expect(200);
    expect(abertas.body.meta.total).toBe(3);
    await autenticado('post', '/carnes/baixa')
      .send({ parcelas: [{ codigo: abertas.body.data[0].codigo }] })
      .expect(200);
    expect((await autenticado('get', `/carnes?idCliente=${idCliente}`)).body.meta.total).toBe(2);

    // Cliente com vendas não pode ser excluído.
    await autenticado('delete', `/clientes/${idCliente}`).expect(409);

    const dashboard = await autenticado('get', '/relatorios/dashboard').expect(200);
    expect(dashboard.body.data.quantidadeVendas).toBeGreaterThan(0);
    const ranking = await autenticado('get', '/relatorios/produtos-mais-vendidos?limite=100').expect(200);
    expect(ranking.body.data.produtos.some((p: { idProduto: number }) => p.idProduto === idProduto)).toBe(true);
  });
});
