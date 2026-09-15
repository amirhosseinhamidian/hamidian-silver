import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp, configureHttpServer, getListenOptions } from './app.setup';
import { configureSwagger } from './openapi';

const bootstrapLogger = new Logger('Bootstrap');

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  configureApp(app);
  configureSwagger(app);
  app.enableShutdownHooks();

  const { host, port } = getListenOptions(app);

  await app.listen(port, host);
  configureHttpServer(app);
}

void bootstrap().catch((error: unknown) => {
  bootstrapLogger.error(
    'Application bootstrap failed.',
    error instanceof Error ? error.stack : undefined,
  );
  process.exitCode = 1;
});
