import { NestFactory } from '@nestjs/core';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { AppModule } from './app.module';
import { configureApiRouting } from './app.setup';
import { createOpenApiDocument } from './openapi';

const OPENAPI_OUTPUT_PATH = resolve(process.cwd(), '../../packages/contracts/openapi.json');

function configureOpenApiEnvironment(): void {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL ??= 'postgresql://openapi:openapi@127.0.0.1:5432/openapi';
  process.env.OTP_PEPPER ??= 'openapi-contract-generation-placeholder-0001';
  process.env.SMS_PROVIDER = 'disabled';
  process.env.PAYMENT_PROVIDER = 'disabled';
  process.env.SHIPPING_PROVIDER = 'disabled';
}

async function generateOpenApiDocument(): Promise<void> {
  configureOpenApiEnvironment();

  const app = await NestFactory.create(AppModule, { logger: false });

  try {
    configureApiRouting(app);

    const document = createOpenApiDocument(app);

    await mkdir(dirname(OPENAPI_OUTPUT_PATH), { recursive: true });
    await writeFile(OPENAPI_OUTPUT_PATH, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
  } finally {
    await app.close();
  }
}

void generateOpenApiDocument().catch((error: unknown) => {
  console.error('OpenAPI generation failed.', error);
  process.exitCode = 1;
});
