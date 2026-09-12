import type { PaymentResultStatus } from '@/components/checkout/payment-result';

// A callback query string alone is not proof of a successful or failed payment.
export function verifiedPaymentStatus(orderStatus?: string): PaymentResultStatus {
  if (['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'].includes(orderStatus ?? '')) return 'success';
  if (orderStatus === 'CANCELLED' || orderStatus === 'EXPIRED') return 'failed';
  return 'pending';
}
