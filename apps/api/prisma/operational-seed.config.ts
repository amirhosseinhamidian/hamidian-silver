import { normalizeIranianMobile } from '../src/modules/auth/phone-normalizer';
import {
  isPaymentGatewayCode,
  type PaymentGatewayCode,
} from '../src/modules/payments/payment-gateway.constants';

const MAX_TOMAN_INT = 2_147_483_647;

export type OperationalSeedConfig = Readonly<{
  admin: Readonly<{
    phone: string;
    firstName: string | null;
    lastName: string | null;
  }>;
  paymentGateway: PaymentGatewayCode | null;
  warehouse: Readonly<{
    code: string;
    name: string;
  }>;
  manualShippingCostToman: number;
  site: Readonly<{
    siteName: string;
    footerAbout: string;
    contactAddress: string;
    contactPhoneNumbers: string[];
    contactEmail: string | null;
    instagramUrl: string | null;
    telegramUrl: string | null;
    baleUrl: string | null;
  }>;
}>;

function requiredText(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key]?.trim();

  if (!value) {
    throw new Error(`${key} is required when SEED_OPERATIONAL_DATA=true.`);
  }

  return value;
}

function optionalText(value: string | undefined): string | null {
  return value?.trim() || null;
}

function parseManualShippingCost(value: string | undefined): number {
  const normalized = value?.trim() || '0';

  if (!/^\d+$/.test(normalized)) {
    throw new Error('MANUAL_SHIPPING_COST_TOMAN must be a non-negative integer.');
  }

  const amount = Number(normalized);

  if (!Number.isSafeInteger(amount) || amount > MAX_TOMAN_INT) {
    throw new Error(`MANUAL_SHIPPING_COST_TOMAN must not exceed ${MAX_TOMAN_INT}.`);
  }

  return amount;
}

function parsePaymentGateway(env: NodeJS.ProcessEnv): PaymentGatewayCode | null {
  const value = env.OPERATIONAL_PAYMENT_GATEWAY?.trim().toLowerCase() || 'disabled';

  if (value === 'disabled') return null;

  if (!isPaymentGatewayCode(value)) {
    throw new Error('OPERATIONAL_PAYMENT_GATEWAY must be disabled, zarinpal, zibal, or mellat.');
  }

  const requiredCredentialKeys: Record<PaymentGatewayCode, readonly string[]> = {
    zarinpal: ['ZARINPAL_MERCHANT_ID'],
    zibal: ['ZIBAL_MERCHANT_ID'],
    mellat: ['MELLAT_TERMINAL_ID', 'MELLAT_USERNAME', 'MELLAT_PASSWORD'],
  };
  const missingCredentials = requiredCredentialKeys[value].filter((key) => !env[key]?.trim());

  if (missingCredentials.length > 0) {
    throw new Error(
      `Cannot enable ${value}; missing gateway credentials: ${missingCredentials.join(', ')}.`,
    );
  }

  return value;
}

function parseContactPhones(value: string): string[] {
  const phones = [
    ...new Set(
      value
        .split(',')
        .map((phone) => phone.trim())
        .filter(Boolean),
    ),
  ];

  if (phones.length === 0 || phones.some((phone) => phone.length > 20)) {
    throw new Error(
      'OPERATIONAL_CONTACT_PHONES must contain comma-separated phone numbers up to 20 characters.',
    );
  }

  return phones;
}

export function parseOperationalSeedConfig(env: NodeJS.ProcessEnv): OperationalSeedConfig {
  const shippingProvider = env.SHIPPING_PROVIDER?.trim().toLowerCase() || 'disabled';

  if (shippingProvider !== 'disabled') {
    throw new Error(
      'Operational bootstrap requires SHIPPING_PROVIDER=disabled while manual shipping is active.',
    );
  }

  const rawAdminPhone = requiredText(env, 'OPERATIONAL_ADMIN_PHONE');
  let adminPhone: string;

  try {
    adminPhone = normalizeIranianMobile(rawAdminPhone);
  } catch {
    throw new Error('OPERATIONAL_ADMIN_PHONE must be a valid Iranian mobile number.');
  }

  return {
    admin: {
      phone: adminPhone,
      firstName: optionalText(env.OPERATIONAL_ADMIN_FIRST_NAME),
      lastName: optionalText(env.OPERATIONAL_ADMIN_LAST_NAME),
    },
    paymentGateway: parsePaymentGateway(env),
    warehouse: {
      code: optionalText(env.OPERATIONAL_WAREHOUSE_CODE) ?? 'MAIN',
      name: optionalText(env.OPERATIONAL_WAREHOUSE_NAME) ?? 'انبار اصلی',
    },
    manualShippingCostToman: parseManualShippingCost(env.MANUAL_SHIPPING_COST_TOMAN),
    site: {
      siteName: optionalText(env.OPERATIONAL_SITE_NAME) ?? 'نقره حمیدیان',
      footerAbout:
        optionalText(env.OPERATIONAL_FOOTER_ABOUT) ??
        'فروشگاه آنلاین و گالری نقره حمیدیان؛ همراه شما برای انتخابی اصیل و ماندگار.',
      contactAddress: requiredText(env, 'OPERATIONAL_CONTACT_ADDRESS'),
      contactPhoneNumbers: parseContactPhones(requiredText(env, 'OPERATIONAL_CONTACT_PHONES')),
      contactEmail: optionalText(env.OPERATIONAL_CONTACT_EMAIL),
      instagramUrl: optionalText(env.OPERATIONAL_INSTAGRAM_URL),
      telegramUrl: optionalText(env.OPERATIONAL_TELEGRAM_URL),
      baleUrl: optionalText(env.OPERATIONAL_BALE_URL),
    },
  };
}
