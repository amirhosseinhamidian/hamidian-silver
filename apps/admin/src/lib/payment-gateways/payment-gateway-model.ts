export const PAYMENT_GATEWAY_PROVIDERS = ['zarinpal', 'zibal', 'mellat'] as const;

export type AdminPaymentGatewayProvider = (typeof PAYMENT_GATEWAY_PROVIDERS)[number];

export type AdminPaymentGatewaySetting = Readonly<{
  provider: AdminPaymentGatewayProvider;
  displayName: string;
  sortOrder: number;
  isEnabled: boolean;
  isImplemented: boolean;
  isConfigured: boolean;
  isAvailable: boolean;
  updatedAt: string | null;
}>;

export type PaymentGatewayMetadata = Readonly<{
  description: string;
  credentialKeys: readonly string[];
}>;

export const PAYMENT_GATEWAY_METADATA: Record<AdminPaymentGatewayProvider, PaymentGatewayMetadata> =
  {
    zarinpal: {
      description: 'پرداخت اینترنتی زرین‌پال با امکان استفاده از محیط آزمایشی.',
      credentialKeys: ['ZARINPAL_MERCHANT_ID'],
    },
    zibal: {
      description: 'پرداخت اینترنتی از طریق درگاه واسط زیبال.',
      credentialKeys: ['ZIBAL_MERCHANT_ID'],
    },
    mellat: {
      description: 'درگاه مستقیم به‌پرداخت ملت برای پذیرنده بانکی.',
      credentialKeys: ['MELLAT_TERMINAL_ID', 'MELLAT_USERNAME', 'MELLAT_PASSWORD'],
    },
  };

export function isAdminPaymentGatewayProvider(value: string): value is AdminPaymentGatewayProvider {
  return PAYMENT_GATEWAY_PROVIDERS.some((provider) => provider === value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseGateway(value: unknown): AdminPaymentGatewaySetting | null {
  if (!isRecord(value)) return null;
  const provider = value.provider;
  if (typeof provider !== 'string' || !isAdminPaymentGatewayProvider(provider)) return null;
  if (
    typeof value.displayName !== 'string' ||
    typeof value.sortOrder !== 'number' ||
    !Number.isFinite(value.sortOrder) ||
    typeof value.isEnabled !== 'boolean' ||
    typeof value.isImplemented !== 'boolean' ||
    typeof value.isConfigured !== 'boolean' ||
    typeof value.isAvailable !== 'boolean' ||
    (value.updatedAt !== null && typeof value.updatedAt !== 'string')
  ) {
    return null;
  }

  return {
    provider,
    displayName: value.displayName,
    sortOrder: value.sortOrder,
    isEnabled: value.isEnabled,
    isImplemented: value.isImplemented,
    isConfigured: value.isConfigured,
    isAvailable: value.isAvailable,
    updatedAt: value.updatedAt,
  };
}

export function parsePaymentGatewaySettings(
  value: unknown,
): readonly AdminPaymentGatewaySetting[] | null {
  if (!Array.isArray(value)) return null;
  const parsed = value.map(parseGateway);
  if (parsed.some((setting) => setting === null)) return null;
  return (parsed as AdminPaymentGatewaySetting[]).sort(
    (first, second) => first.sortOrder - second.sortOrder,
  );
}
