import type { PaymentResultStatus } from '@/components/checkout/payment-result';

// A callback query string alone is not proof of a successful or failed payment.
export function verifiedPaymentStatus(
  orderStatus?: string,
  paymentStatus?: string,
  receiptSubmitted = false,
): PaymentResultStatus {
  if (['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'].includes(orderStatus ?? '')) return 'success';
  if (paymentStatus === 'RECONCILIATION_REQUIRED') return 'pending';
  if (orderStatus === 'CANCELLED' || orderStatus === 'EXPIRED') return 'failed';
  if (receiptSubmitted && paymentStatus === 'AWAITING_REVIEW') return 'receipt-pending';
  return 'pending';
}
