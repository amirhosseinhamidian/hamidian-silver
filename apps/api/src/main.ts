import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp, configureHttpServer, getListenOptions } from './app.setup';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

const bootstrapLogger = new Logger('Bootstrap');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  configureApp(app);
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Hamidian Silver API')
    .setDescription('Backend API documentation')
    .setVersion('1.0')
    .build();

  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swaggerConfig));
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
