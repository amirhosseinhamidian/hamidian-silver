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

  it('shows ongoing reconciliation for a late confirmation on an expired order', () => {
    expect(verifiedPaymentStatus('EXPIRED', 'RECONCILIATION_REQUIRED', true)).toBe('pending');
    expect(verifiedPaymentStatus('EXPIRED', 'REFUNDED')).toBe('failed');
    expect(verifiedPaymentStatus('PAID', 'PAID', true)).toBe('success');
  });

  it('uses the receipt message only when the server confirms a receipt awaiting review', () => {
    expect(verifiedPaymentStatus('PENDING_PAYMENT', undefined, true)).toBe('pending');
    expect(verifiedPaymentStatus('PENDING_PAYMENT', 'AWAITING_REVIEW', true)).toBe(
      'receipt-pending',
    );
  });
});
