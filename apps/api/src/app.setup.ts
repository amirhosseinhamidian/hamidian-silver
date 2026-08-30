import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';

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

export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService);
  const corsOrigins = parseCorsOrigins(
    config.getOrThrow<string>('CORS_ORIGINS'),
  );

  app.use(helmet());

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  app.setGlobalPrefix('api');

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

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

export function getListenOptions(app: INestApplication): ListenOptions {
  const config = app.get(ConfigService);

  return {
    host: config.getOrThrow<string>('HOST'),
    port: config.getOrThrow<number>('PORT'),
  };
}
