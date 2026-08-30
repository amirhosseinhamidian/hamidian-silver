import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  HOST: Joi.string().default('0.0.0.0'),
  PORT: Joi.number().port().default(3000),
  CORS_ORIGINS: Joi.string().min(1).default('http://localhost:3001,http://localhost:3002'),
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
});
