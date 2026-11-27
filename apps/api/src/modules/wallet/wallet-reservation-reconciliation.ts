import type {
  OrderStatus,
  PaymentAttemptStatus,
  PaymentStatus,
} from '../../generated/prisma/enums';
import { openWalletAttemptStatuses } from './wallet-checkout.service';

type ReservationState = {
  reservationAmountToman: number;
  allocatedToman: bigint;
  reservationUserId: string;
  reservedAt: Date;
  order: {
    userId: string;
    walletAppliedToman: number;
    status: OrderStatus;
    paidAt: Date | null;
    reservationExpiresAt: Date;
  };
  payment: { status: PaymentStatus; paidAt: Date | null } | null;
  attempts: readonly {
    status: PaymentAttemptStatus;
    updatedAt: Date;
    failureCode?: string | null;
  }[];
};

const openAttempts = new Set<PaymentAttemptStatus>(openWalletAttemptStatuses);
const paidOrders = new Set<OrderStatus>(['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED']);

export function classifyWalletReservation(state: ReservationState, now: Date) {
  const { order, payment, attempts } = state;
  if (
    order.userId !== state.reservationUserId ||
    order.walletAppliedToman !== state.reservationAmountToman ||
    BigInt(state.reservationAmountToman) !== state.allocatedToman
  ) {
    return 'RESERVATION_MISMATCH';
  }
  if (
    order.paidAt ||
    paidOrders.has(order.status) ||
    payment?.paidAt ||
    payment?.status === 'PAID' ||
    payment?.status === 'PARTIALLY_REFUNDED' ||
    attempts.some(({ status }) => status === 'VERIFIED')
  ) {
    return 'SETTLEMENT_MISMATCH';
  }
  const terminal = order.status === 'CANCELLED' || order.status === 'EXPIRED';
  const overdue = terminal || order.reservationExpiresAt <= now;
  if (
    payment?.status === 'AWAITING_REVIEW' ||
    attempts.some(({ status }) => status === 'AWAITING_REVIEW')
  ) {
    return overdue ? 'RECEIPT_PENDING' : 'KEEP';
  }
  if (
    payment?.status === 'RECONCILIATION_REQUIRED' ||
    attempts.some(({ status }) => status === 'RECONCILIATION_REQUIRED')
  ) {
    return 'PAYMENT_UNCERTAIN';
  }
  if (attempts.some(({ status }) => openAttempts.has(status))) {
    return overdue ? 'PAYMENT_UNCERTAIN' : 'KEEP';
  }
  if (
    terminal ||
    attempts.some(
      ({ status, updatedAt, failureCode }) =>
        updatedAt > state.reservedAt &&
        ((status === 'FAILED' && failureCode !== 'PAYMENT_METHOD_CHANGED') ||
          status === 'RECONCILED'),
    )
  ) {
    return 'RELEASE';
  }
  return overdue ? 'RESERVATION_OVERDUE' : 'KEEP';
}
