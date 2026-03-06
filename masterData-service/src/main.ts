import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@traeta/prisma';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  
  // Initialize and connect Prisma
  const prismaService = app.get(PrismaService);
  await prismaService.$connect();
  await prismaService.enableShutdownHooks(app);
  
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe());
  app.setGlobalPrefix('/');

  const config = new DocumentBuilder()
    .setTitle('Master Data Service API')
    .setDescription(
      'API documentation for the Master Data Service\n\n' +
      '## Features\n' +
      '- Master data management (key-value configurations)\n' +
      '- Lists and categories management\n' +
      '- Integration metadata management\n' +
      '- List-integration mapping\n\n' +
      '## Overview\n' +
      'This service manages all master data, lists, categories, and integration configurations for the Traeta platform.'
    )
    .setVersion('1.0')
    .addTag('Master Data', 'Master data CRUD operations')
    .addTag('Lists', 'Lists management endpoints')
    .addTag('Integrations', 'Integration metadata management')
    .addTag('Item Categories', 'Item categories management')
    .addTag('List Integration Mapping', 'Mapping between lists and integrations')
    .addServer('http://localhost:3002', 'Local Development Server')
    .addServer('http://192.168.1.39:3002', 'Network Development Server')
    .addServer('https://dev.traeta.com/master', 'Production Server')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document, {
    customSiteTitle: 'Master Data Service API Documentation',
    customCss: '.swagger-ui .topbar { display: none }',
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'none',
      filter: true,
      showRequestDuration: true,
    },
  });

  await app.listen(configService.get('MASTERDATA_PORT') || 3002);
}
void bootstrap();
