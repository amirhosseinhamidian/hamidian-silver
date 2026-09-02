import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { configureHttpServer } from './app.setup';

describe('configureHttpServer', () => {
  it('applies bounded production HTTP server settings', () => {
    const values: Record<string, number> = {
      HTTP_REQUEST_TIMEOUT_MS: 30_000,
      HTTP_HEADERS_TIMEOUT_MS: 15_000,
      HTTP_KEEP_ALIVE_TIMEOUT_MS: 5_000,
      HTTP_MAX_REQUESTS_PER_SOCKET: 1_000,
    };
    const config = {
      getOrThrow: jest.fn((key: string) => values[key]),
    };
    const server = {
      requestTimeout: 0,
      headersTimeout: 0,
      keepAliveTimeout: 0,
      maxRequestsPerSocket: 0,
    };
    const app = {
      get: jest.fn((token: unknown) => {
        if (token === ConfigService) {
          return config;
        }

        throw new Error('Unexpected provider');
      }),
      getHttpServer: jest.fn(() => server),
    } as unknown as INestApplication;

    configureHttpServer(app);

    expect(server).toEqual(valuesAsServerSettings(values));
  });
});

function valuesAsServerSettings(values: Record<string, number>) {
  return {
    requestTimeout: values.HTTP_REQUEST_TIMEOUT_MS,
    headersTimeout: values.HTTP_HEADERS_TIMEOUT_MS,
    keepAliveTimeout: values.HTTP_KEEP_ALIVE_TIMEOUT_MS,
    maxRequestsPerSocket: values.HTTP_MAX_REQUESTS_PER_SOCKET,
  };
}
