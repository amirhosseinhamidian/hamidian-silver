import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp, getListenOptions } from './app.setup';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  configureApp(app);
  app.enableShutdownHooks();

  const { host, port } = getListenOptions(app);

  await app.listen(port, host);
}

void bootstrap();
