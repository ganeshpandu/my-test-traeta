import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { json, urlencoded } from 'express';
import { PrismaService } from '@traeta/prisma';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Initialize and connect Prisma
  const prismaService = app.get(PrismaService);
  await prismaService.$connect();
  await prismaService.enableShutdownHooks(app);

  // Increase request body size limits
  app.use(json({ limit: '20mb' }));
  app.use(urlencoded({ extended: true, limit: '20mb' }));

  // Configure CORS properly
  const corsOrigin = configService.get('CORS_ORIGIN') || '*';
  app.enableCors({
    origin:
      corsOrigin === '*'
        ? true
        : corsOrigin.split(',').map((o: string) => o.trim()),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'Origin',
      'X-Requested-With',
    ],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false,
    }),
  );
  app.setGlobalPrefix('user');

  const config = new DocumentBuilder()
    .setTitle('User Service API')
    .setDescription(
      'API documentation for the User Service\n\n' +
        '## Features\n' +
        '- User authentication and profile management\n' +
        '- Third-party integrations (Spotify, Strava, Plaid, Apple Music, etc.)\n' +
        '- OAuth 2.0 flows for external services\n' +
        '- Data synchronization from connected services\n\n' +
        '## Authentication\n' +
        'Most endpoints require Firebase authentication. Include your Firebase ID token in the Authorization header as a Bearer token.',
    )
    .setVersion('1.0')
    .addTag(
      'Authentication',
      'User authentication endpoints (sign up, login, logout)',
    )
    .addTag('User Profile', 'User profile management endpoints')
    .addTag(
      'Integrations',
      'Third-party integration endpoints for connecting external services',
    )
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      name: 'Authorization',
      description: 'Enter your Firebase ID token here',
      in: 'header',
    })
    .addServer('http://localhost:3001', 'Local Development Server')
    .addServer('http://192.168.1.39:3001', 'Network Development Server')
    .addServer('https://dev.traeta.com', 'Production Server')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('user/api', app, document, {
    customSiteTitle: 'User Service API Documentation',
    customCss: '.swagger-ui .topbar { display: none }',
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'none',
      filter: true,
      showRequestDuration: true,
    },
  });

  const port = configService.get('USER_PORT') || 3001;
  const host = configService.get('HOST') || '0.0.0.0';
  await app.listen(port, host);
  console.log(`User Service is running on http://${host}:${port}`);
}
void bootstrap();
