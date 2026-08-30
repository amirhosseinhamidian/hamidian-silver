export const PAYMENT_GATEWAY_CODES = {
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
    code: PAYMENT_GATEWAY_CODES.ZARINPAL,
    displayName: 'زرین‌پال',
    sortOrder: 10,
  },
  {
    code: PAYMENT_GATEWAY_CODES.ZIBAL,
    displayName: 'زیبال',
    sortOrder: 20,
  },
  {
    code: PAYMENT_GATEWAY_CODES.MELLAT,
    displayName: 'درگاه مستقیم بانک ملت',
    sortOrder: 30,
  },
];

const PAYMENT_GATEWAY_CODE_SET = new Set<string>(Object.values(PAYMENT_GATEWAY_CODES));

export function isPaymentGatewayCode(value: string): value is PaymentGatewayCode {
  return PAYMENT_GATEWAY_CODE_SET.has(value);
}
