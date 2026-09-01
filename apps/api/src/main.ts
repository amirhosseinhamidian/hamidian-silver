import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp, configureHttpServer, getListenOptions } from './app.setup';

const bootstrapLogger = new Logger('Bootstrap');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  configureApp(app);
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
