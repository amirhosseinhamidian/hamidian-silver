import { envValidationSchema } from './env.validation';

describe('envValidationSchema production HTTP settings', () => {
  const requiredEnvironment = {
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/hamidian_silver',
    OTP_PEPPER: 'a-secure-test-pepper-with-at-least-32-characters',
  };

  it('applies bounded HTTP server defaults', () => {
    const { error, value } = envValidationSchema.validate(requiredEnvironment, {
      allowUnknown: true,
      abortEarly: false,
    });

    expect(error).toBeUndefined();
    expect(value).toEqual(
      expect.objectContaining({
        HTTP_REQUEST_TIMEOUT_MS: 30_000,
        HTTP_HEADERS_TIMEOUT_MS: 15_000,
        HTTP_KEEP_ALIVE_TIMEOUT_MS: 5_000,
        HTTP_MAX_REQUESTS_PER_SOCKET: 1_000,
      }),
    );
  });

  it('rejects unbounded HTTP server settings', () => {
    const { error } = envValidationSchema.validate(
      {
        ...requiredEnvironment,
        HTTP_REQUEST_TIMEOUT_MS: 0,
        HTTP_MAX_REQUESTS_PER_SOCKET: 0,
      },
      {
        allowUnknown: true,
        abortEarly: false,
      },
    );

    expect(error?.details.map(({ path }) => path.join('.'))).toEqual(
      expect.arrayContaining(['HTTP_REQUEST_TIMEOUT_MS', 'HTTP_MAX_REQUESTS_PER_SOCKET']),
    );
  });

  it('allows console OTP delivery outside production', () => {
    const { error, value } = envValidationSchema.validate(
      {
        ...requiredEnvironment,
        NODE_ENV: 'development',
        SMS_PROVIDER: 'console',
      },
      {
        allowUnknown: true,
        abortEarly: false,
      },
    );

    expect(error).toBeUndefined();
    expect(value.SMS_PROVIDER).toBe('console');
  });

  it('rejects console OTP delivery in production', () => {
    const { error } = envValidationSchema.validate(
      {
        ...requiredEnvironment,
        NODE_ENV: 'production',
        MEDIA_STORAGE_ROOT: '.data/media',
        MEDIA_PUBLIC_BASE_URL: 'https://silver.example/media',
        SMS_PROVIDER: 'console',
      },
      {
        allowUnknown: true,
        abortEarly: false,
      },
    );

    expect(error?.details.map(({ path }) => path.join('.'))).toContain('SMS_PROVIDER');
  });

  it('requires an absolute persistent media path in production', () => {
    const { error } = envValidationSchema.validate(
      {
        ...requiredEnvironment,
        NODE_ENV: 'production',
        MEDIA_STORAGE_ROOT: '.data/media',
        MEDIA_PUBLIC_BASE_URL: 'https://silver.example/media',
      },
      { allowUnknown: true, abortEarly: false },
    );

    expect(error?.details.map(({ path }) => path.join('.'))).toContain('MEDIA_STORAGE_ROOT');
  });
});
