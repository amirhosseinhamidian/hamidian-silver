import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  HOST: Joi.string().default('0.0.0.0'),
  PORT: Joi.number().port().default(3000),
  HTTP_REQUEST_TIMEOUT_MS: Joi.number().integer().min(1000).max(120000).default(30000),
  HTTP_HEADERS_TIMEOUT_MS: Joi.number().integer().min(1000).max(120000).default(15000),
  HTTP_KEEP_ALIVE_TIMEOUT_MS: Joi.number().integer().min(1000).max(30000).default(5000),
  HTTP_MAX_REQUESTS_PER_SOCKET: Joi.number().integer().min(1).max(10000).default(1000),
  CORS_ORIGINS: Joi.string().min(1).default('http://localhost:3001,http://localhost:3002'),
  MEDIA_STORAGE_ROOT: Joi.when('NODE_ENV', {
    is: 'production',
    // oxlint-disable-next-line unicorn/no-thenable -- `then` is Joi conditional syntax.
    then: Joi.string().min(1).empty('').required(),
    otherwise: Joi.string().min(1).empty('').default('.data/media'),
  }),
  MEDIA_PUBLIC_BASE_URL: Joi.when('NODE_ENV', {
    is: 'production',
    // oxlint-disable-next-line unicorn/no-thenable -- `then` is Joi conditional syntax.
    then: Joi.string()
      .uri({ scheme: ['http', 'https'] })
      .empty('')
      .required(),
    otherwise: Joi.string()
      .uri({ scheme: ['http', 'https'] })
      .empty('')
      .default('http://localhost:3000/media'),
  }),
  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgresql', 'postgres'] })
    .required(),
  OTP_PEPPER: Joi.string().min(32).required(),
  AUTH_SESSION_TTL_DAYS: Joi.number().integer().min(1).max(90).default(30),
  SMS_PROVIDER: Joi.string().valid('disabled', 'kavenegar').default('disabled'),
  KAVENEGAR_API_KEY: Joi.when('SMS_PROVIDER', {
    is: 'kavenegar',
    // oxlint-disable-next-line unicorn/no-thenable -- `then` is Joi conditional syntax.
    then: Joi.string().min(10).required(),
    otherwise: Joi.string().allow('').optional(),
  }),
  KAVENEGAR_OTP_TEMPLATE: Joi.when('SMS_PROVIDER', {
    is: 'kavenegar',
    // oxlint-disable-next-line unicorn/no-thenable -- `then` is Joi conditional syntax.
    then: Joi.string().min(1).required(),
    otherwise: Joi.string().allow('').optional(),
  }),
  PAYMENT_PROVIDER: Joi.string().valid('disabled', 'zarinpal').default('disabled'),
  PAYMENT_CALLBACK_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .default('http://localhost:3000/api/v1/payments/callback'),
  ZARINPAL_MERCHANT_ID: Joi.string().guid().allow('').optional(),
  ZARINPAL_SANDBOX: Joi.boolean().truthy('true').falsy('false').default(true),
  ZIBAL_MERCHANT_ID: Joi.string().min(1).allow('').optional(),
  SHIPPING_PROVIDER: Joi.string().valid('disabled', 'postex').default('disabled'),
  POSTEX_API_BASE_URL: Joi.string()
    .uri({ scheme: ['https'] })
    .default('https://api.postex.ir/api/v1'),
  POSTEX_TRACKING_BASE_URL: Joi.string()
    .uri({ scheme: ['https'] })
    .default('https://api.postex.ir/api/app/v1'),
  POSTEX_API_KEY: Joi.when('SHIPPING_PROVIDER', {
    is: 'postex',
    // oxlint-disable-next-line unicorn/no-thenable -- `then` is Joi conditional syntax.
    then: Joi.string().min(10).required(),
    otherwise: Joi.string().allow('').optional(),
  }),
  POSTEX_ORIGIN_CITY_CODE: Joi.when('SHIPPING_PROVIDER', {
    is: 'postex',
    // oxlint-disable-next-line unicorn/no-thenable -- `then` is Joi conditional syntax.
    then: Joi.number().integer().positive().required(),
    otherwise: Joi.number().integer().positive().optional(),
  }),
  POSTEX_ORIGIN_CITY_NAME: Joi.when('SHIPPING_PROVIDER', {
    is: 'postex',
    // oxlint-disable-next-line unicorn/no-thenable -- `then` is Joi conditional syntax.
    then: Joi.string().min(1).required(),
    otherwise: Joi.string().allow('').optional(),
  }),
  POSTEX_ORIGIN_POSTAL_CODE: Joi.when('SHIPPING_PROVIDER', {
    is: 'postex',
    // oxlint-disable-next-line unicorn/no-thenable -- `then` is Joi conditional syntax.
    then: Joi.string()
      .pattern(/^\d{10}$/)
      .required(),
    otherwise: Joi.string().allow('').optional(),
  }),
  POSTEX_ORIGIN_ADDRESS: Joi.when('SHIPPING_PROVIDER', {
    is: 'postex',
    // oxlint-disable-next-line unicorn/no-thenable -- `then` is Joi conditional syntax.
    then: Joi.string().min(5).required(),
    otherwise: Joi.string().allow('').optional(),
  }),
  POSTEX_ORIGIN_FIRST_NAME: Joi.when('SHIPPING_PROVIDER', {
    is: 'postex',
    // oxlint-disable-next-line unicorn/no-thenable -- `then` is Joi conditional syntax.
    then: Joi.string().min(1).required(),
    otherwise: Joi.string().allow('').optional(),
  }),
  POSTEX_ORIGIN_LAST_NAME: Joi.when('SHIPPING_PROVIDER', {
    is: 'postex',
    // oxlint-disable-next-line unicorn/no-thenable -- `then` is Joi conditional syntax.
    then: Joi.string().min(1).required(),
    otherwise: Joi.string().allow('').optional(),
  }),
  POSTEX_ORIGIN_MOBILE: Joi.when('SHIPPING_PROVIDER', {
    is: 'postex',
    // oxlint-disable-next-line unicorn/no-thenable -- `then` is Joi conditional syntax.
    then: Joi.string()
      .pattern(/^(?:\+98|98|0)?9\d{9}$/)
      .required(),
    otherwise: Joi.string().allow('').optional(),
  }),
  POSTEX_ORIGIN_PHONE: Joi.string().allow('').optional(),
  POSTEX_ORIGIN_COMPANY_NAME: Joi.string().allow('').optional(),
  POSTEX_BOX_TYPE_ID: Joi.when('SHIPPING_PROVIDER', {
    is: 'postex',
    // oxlint-disable-next-line unicorn/no-thenable -- `then` is Joi conditional syntax.
    then: Joi.number().integer().positive().required(),
    otherwise: Joi.number().integer().positive().optional(),
  }),
  POSTEX_COLLECTION_TYPE: Joi.when('SHIPPING_PROVIDER', {
    is: 'postex',
    // oxlint-disable-next-line unicorn/no-thenable -- `then` is Joi conditional syntax.
    then: Joi.string().min(1).required(),
    otherwise: Joi.string().allow('').optional(),
  }),
  POSTEX_PAYMENT_TYPE: Joi.string().valid('SENDER', 'RECEIVER').default('SENDER'),
  POSTEX_REQUEST_TIMEOUT_MS: Joi.number().integer().min(1000).max(60000).default(15000),
});
