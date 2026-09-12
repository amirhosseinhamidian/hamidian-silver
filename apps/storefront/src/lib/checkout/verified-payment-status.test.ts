import { describe, expect, it } from 'vitest';

import { verifiedPaymentStatus } from '@/lib/checkout/verified-payment-status';

describe('verified payment result', () => {
  it('treats a missing or unconfirmed order as pending despite callback claims', () => {
    expect(verifiedPaymentStatus()).toBe('pending');
    expect(verifiedPaymentStatus('PENDING_PAYMENT')).toBe('pending');
  });

  it('uses only the confirmed server order state for success and failure', () => {
    expect(verifiedPaymentStatus('PAID')).toBe('success');
    expect(verifiedPaymentStatus('SHIPPED')).toBe('success');
    expect(verifiedPaymentStatus('EXPIRED')).toBe('failed');
  });
});
