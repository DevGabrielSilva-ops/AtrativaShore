/**
 * Sobe a aplicação inteira (AppModule real: DI, guards, pipes, filtro,
 * interceptor e Swagger) trocando apenas a conexão MySQL por uma falsa.
 * Não precisa de banco; confere a "fiação" da API e o contrato HTTP básico.
 */
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';

process.env.JWT_SECRET = 'segredo-de-teste-com-mais-de-trinta-e-dois-caracteres';
process.env.DB_HOST = '127.0.0.1';
process.env.DB_USERNAME = 'teste';
process.env.DB_DATABASE = 'teste';

const bancoFalso = {
  isInitialized: true,
  options: { type: 'mysql' },
  entityMetadatas: [],
  manager: {},
  query: async (sql: string) => {
    // Simula um banco já migrado (InnoDB, api_credencial e vr_pix existentes).
    if (sql.includes('ENGINE AS motor')) return [];
    if (sql.includes('information_schema')) return [{ 1: 1 }];
    return [];
  },
  getRepository: () => ({}),
  destroy: async () => undefined,
};

describe('inicialização da API (sem banco)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const { AppModule } = await import('../src/app.module.js');
    const { fabricaExcecaoValidacao } = await import('../src/common/validacao/mensagens-validacao.js');
    const modulo = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DataSource)
      .useValue(bancoFalso)
      .compile();
    app = modulo.createNestApplication({ logger: false });
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, exceptionFactory: fabricaExcecaoValidacao }),
    );
    await app.init();
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  it('rota pública de saúde responde no envelope { data }', async () => {
    const resposta = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(resposta.body.data).toMatchObject({ status: 'ok', migrations: { tabelasInnodb: true } });
  });

  it('rotas privadas exigem token (401 no formato padrão de erro)', async () => {
    for (const rota of ['/api/v1/clientes', '/api/v1/vendas', '/api/v1/relatorios/dashboard', '/api/v1/estoque']) {
      const resposta = await request(app.getHttpServer()).get(rota).expect(401);
      expect(resposta.body).toMatchObject({ statusCode: 401, error: 'Unauthorized', path: rota });
      expect(resposta.body.timestamp).toBeDefined();
    }
  });

  it('valida o corpo do login antes de consultar o banco, com mensagens em português', async () => {
    const resposta = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ login: '', senha: 123, extra: true })
      .expect(400);
    expect(resposta.body.message).toEqual(
      expect.arrayContaining(['o campo extra não é permitido', 'login é obrigatório', 'senha deve ser um texto']),
    );
  });

  it('rejeita token inválido', async () => {
    await request(app.getHttpServer()).get('/api/v1/auth/me').set('Authorization', 'Bearer abc.def.ghi').expect(401);
  });

  it('gera o documento Swagger com todas as rotas', () => {
    const documento = SwaggerModule.createDocument(app, new DocumentBuilder().addBearerAuth().build());
    const rotas = Object.keys(documento.paths);
    for (const esperada of [
      '/api/v1/auth/login',
      '/api/v1/empresa',
      '/api/v1/clientes',
      '/api/v1/clientes/{id}/vendas',
      '/api/v1/fornecedores',
      '/api/v1/produtos',
      '/api/v1/produtos/estoque-baixo',
      '/api/v1/estoque/entradas',
      '/api/v1/estoque/ajustes',
      '/api/v1/estoque/movimentacoes',
      '/api/v1/vendas',
      '/api/v1/vendas/{id}/estorno',
      '/api/v1/carnes',
      '/api/v1/carnes/baixa',
      '/api/v1/caixa/abrir',
      '/api/v1/caixa/fechar',
      '/api/v1/relatorios/dashboard',
      '/api/v1/relatorios/produtos-mais-vendidos',
      '/api/v1/relatorios/clientes-debito',
    ]) {
      expect(rotas).toContain(esperada);
    }
    const venda = documento.components?.schemas?.RegistrarVendaDto as { properties: Record<string, unknown> };
    expect(Object.keys(venda.properties)).toEqual(
      expect.arrayContaining(['idCliente', 'itens', 'itensTroca', 'desconto', 'acrescimo', 'pagamentos', 'parcelasCarne']),
    );
  });
});
