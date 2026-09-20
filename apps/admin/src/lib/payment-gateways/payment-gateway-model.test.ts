import { describe, expect, it } from 'vitest';

import {
  isAdminPaymentGatewayProvider,
  parsePaymentGatewaySettings,
} from '@/lib/payment-gateways/payment-gateway-model';

const gateway = {
  provider: 'irandargah',
  displayName: 'ایران‌درگاه',
  sortOrder: 10,
  isEnabled: true,
  isImplemented: true,
  isConfigured: true,
  isAvailable: true,
  updatedAt: '2026-09-08T09:00:00.000Z',
};

describe('payment gateway model', () => {
  it('parses and sorts the supported gateway states', () => {
    expect(
      parsePaymentGatewaySettings([
        gateway,
        { ...gateway, provider: 'mellat', displayName: 'ملت', sortOrder: 20 },
      ])?.map(({ provider }) => provider),
    ).toEqual(['irandargah', 'mellat']);
  });

  it('rejects malformed or unknown gateway responses', () => {
    expect(parsePaymentGatewaySettings([{ ...gateway, isConfigured: 'yes' }])).toBeNull();
    expect(parsePaymentGatewaySettings([{ ...gateway, provider: 'unknown' }])).toBeNull();
    expect(isAdminPaymentGatewayProvider('mellat')).toBe(true);
    expect(isAdminPaymentGatewayProvider('unknown')).toBe(false);
  });
});
