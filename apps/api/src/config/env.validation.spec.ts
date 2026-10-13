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

  it('keeps stock notifications disabled without requiring a Kavenegar template', () => {
    const kavenegarEnvironment = {
      ...requiredEnvironment,
      SMS_PROVIDER: 'kavenegar',
      KAVENEGAR_API_KEY: 'kavenegar-test-api-key',
      KAVENEGAR_OTP_TEMPLATE: 'hamidianotp',
      KAVENEGAR_PAYMENT_VERIFIED_TEMPLATE: 'hamidianpayment',
      KAVENEGAR_PAYMENT_RECEIPT_SUBMITTED_TEMPLATE: 'hamidianreceipt',
      KAVENEGAR_PAYMENT_RECEIPT_REJECTED_TEMPLATE: 'hamidianreceiptrejected',
      KAVENEGAR_SHIPMENT_TRACKING_TEMPLATE: 'hamidiantracking',
      KAVENEGAR_ORDER_SHIPPED_TEMPLATE: 'hamidianshipped',
      KAVENEGAR_ORDER_DELIVERED_TEMPLATE: 'hamidiandelivered',
      KAVENEGAR_ORDER_CANCELLED_TEMPLATE: 'hamidiancancelled',
    };
    const disabled = envValidationSchema.validate(kavenegarEnvironment, {
      allowUnknown: true,
      abortEarly: false,
    });

    expect(disabled.error).toBeUndefined();
    expect(disabled.value.STOCK_NOTIFICATIONS_ENABLED).toBe(false);
  });

  it('requires an approved Kavenegar template when stock notifications are enabled', () => {
    const kavenegarEnvironment = {
      ...requiredEnvironment,
      SMS_PROVIDER: 'kavenegar',
      KAVENEGAR_API_KEY: 'kavenegar-test-api-key',
      KAVENEGAR_OTP_TEMPLATE: 'hamidianotp',
      KAVENEGAR_PAYMENT_VERIFIED_TEMPLATE: 'hamidianpayment',
      KAVENEGAR_PAYMENT_RECEIPT_SUBMITTED_TEMPLATE: 'hamidianreceipt',
      KAVENEGAR_PAYMENT_RECEIPT_REJECTED_TEMPLATE: 'hamidianreceiptrejected',
      KAVENEGAR_SHIPMENT_TRACKING_TEMPLATE: 'hamidiantracking',
      KAVENEGAR_ORDER_SHIPPED_TEMPLATE: 'hamidianshipped',
      KAVENEGAR_ORDER_DELIVERED_TEMPLATE: 'hamidiandelivered',
      KAVENEGAR_ORDER_CANCELLED_TEMPLATE: 'hamidiancancelled',
      STOCK_NOTIFICATIONS_ENABLED: 'true',
    };
    const missing = envValidationSchema.validate(kavenegarEnvironment, {
      allowUnknown: true,
      abortEarly: false,
    });

    expect(missing.error?.details.map(({ path }) => path.join('.'))).toContain(
      'KAVENEGAR_STOCK_AVAILABLE_TEMPLATE',
    );

    const configured = envValidationSchema.validate(
      {
        ...kavenegarEnvironment,
        KAVENEGAR_STOCK_AVAILABLE_TEMPLATE: 'hamidianstock',
      },
      { allowUnknown: true, abortEarly: false },
    );
    expect(configured.error).toBeUndefined();
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

  it('validates Mellat gateway endpoints and operational timeout', () => {
    const { error } = envValidationSchema.validate(
      {
        ...requiredEnvironment,
        MELLAT_TERMINAL_ID: '1234567',
        MELLAT_USERNAME: 'merchant-user',
        MELLAT_PASSWORD: 'merchant-password',
        MELLAT_SOAP_URL: 'http://unsafe.example.test/soap',
        MELLAT_REQUEST_TIMEOUT_MS: 500,
      },
      { allowUnknown: true, abortEarly: false },
    );

    expect(error?.details.map(({ path }) => path.join('.'))).toEqual(
      expect.arrayContaining(['MELLAT_SOAP_URL', 'MELLAT_REQUEST_TIMEOUT_MS']),
    );
  });
});
