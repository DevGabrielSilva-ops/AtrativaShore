import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { fabricaExcecaoValidacao } from './common/validacao/mensagens-validacao.js';
import { ConfiguracaoService } from './config/configuracao.service.js';

async function iniciar(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const { valores } = app.get(ConfiguracaoService);
  const logger = new Logger('Inicializacao');

  app.setGlobalPrefix(valores.prefixoApi);
  app.enableCors({
    origin: valores.origensCors,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Disposition'],
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: fabricaExcecaoValidacao,
    }),
  );
  app.enableShutdownHooks();

  if (valores.swaggerHabilitado) {
    const documento = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Atrativa Shore API')
        .setDescription(
          'API REST da plataforma Atrativa Shore (multiempresa). ' +
            'Autentique em POST /auth/login e use o token no botão "Authorize". ' +
            'Rotas /plataforma são exclusivas do superadministrador; as demais usam a empresa do usuário autenticado. ' +
            'Respostas de sucesso vêm em { data } (listas: { data, meta }); erros em { statusCode, error, message, path, timestamp }.',
        )
        .setVersion('1.0.0')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup(`${valores.prefixoApi}/docs`, app, documento, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  await app.listen(valores.porta);
  const base = `http://localhost:${valores.porta}/${valores.prefixoApi}`;
  logger.log(`API em ${base}`);
  if (valores.swaggerHabilitado) logger.log(`Swagger em ${base}/docs`);
}

await iniciar();
