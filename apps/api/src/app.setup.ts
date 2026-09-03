import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import type { Server } from 'node:http';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { requestIdMiddleware } from './common/request-id.middleware';

export type ListenOptions = {
  host: string;
  port: number;
};

function parseCorsOrigins(value: string): string[] {
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function configureApiRouting(app: INestApplication): void {
  app.setGlobalPrefix('api');

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });
}

export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService);
  const corsOrigins = parseCorsOrigins(config.getOrThrow<string>('CORS_ORIGINS'));

  app.use(requestIdMiddleware);
  app.use(helmet());

  app.useGlobalFilters(new HttpExceptionFilter());

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  configureApiRouting(app);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );
}

export function configureHttpServer(app: INestApplication): void {
  const config = app.get(ConfigService);
  const server = app.getHttpServer() as Server;

  server.requestTimeout = config.getOrThrow<number>('HTTP_REQUEST_TIMEOUT_MS');
  server.headersTimeout = config.getOrThrow<number>('HTTP_HEADERS_TIMEOUT_MS');
  server.keepAliveTimeout = config.getOrThrow<number>('HTTP_KEEP_ALIVE_TIMEOUT_MS');
  server.maxRequestsPerSocket = config.getOrThrow<number>('HTTP_MAX_REQUESTS_PER_SOCKET');
}

export function getListenOptions(app: INestApplication): ListenOptions {
  const config = app.get(ConfigService);

  return {
    host: config.getOrThrow<string>('HOST'),
    port: config.getOrThrow<number>('PORT'),
  };
}
