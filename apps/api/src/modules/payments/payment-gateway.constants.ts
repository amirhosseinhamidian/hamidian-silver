export const PAYMENT_GATEWAY_CODES = {
  IRANDARGAH: 'irandargah',
  ZARINPAL: 'zarinpal',
  ZIBAL: 'zibal',
  MELLAT: 'mellat',
} as const;

export type PaymentGatewayCode = (typeof PAYMENT_GATEWAY_CODES)[keyof typeof PAYMENT_GATEWAY_CODES];

export type PaymentGatewayDefinition = {
  code: PaymentGatewayCode;
  displayName: string;
  sortOrder: number;
};

export const PAYMENT_GATEWAY_DEFINITIONS: readonly PaymentGatewayDefinition[] = [
  {
    code: PAYMENT_GATEWAY_CODES.IRANDARGAH,
    displayName: 'ایران‌درگاه',
    sortOrder: 10,
  },
  {
    code: PAYMENT_GATEWAY_CODES.MELLAT,
    displayName: 'درگاه مستقیم بانک ملت',
    sortOrder: 20,
  },
];

const PAYMENT_GATEWAY_CODE_SET = new Set<string>(Object.values(PAYMENT_GATEWAY_CODES));

export function isPaymentGatewayCode(value: string): value is PaymentGatewayCode {
  return PAYMENT_GATEWAY_CODE_SET.has(value);
}

export function isConfigurablePaymentGatewayCode(value: string): value is PaymentGatewayCode {
  return PAYMENT_GATEWAY_DEFINITIONS.some(({ code }) => code === value);
}
