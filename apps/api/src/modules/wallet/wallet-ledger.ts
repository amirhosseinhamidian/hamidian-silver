import type { WalletBucket, WalletSource } from '../../generated/prisma/enums';

export const bucketField = {
  PENDING: 'pendingToman',
  AVAILABLE: 'availableToman',
  RESERVED: 'reservedToman',
  CAPTURED: 'capturedToman',
  EXPIRED: 'expiredToman',
  REVOKED: 'revokedToman',
} as const satisfies Record<WalletBucket, string>;

export type WalletRequest = {
  userId: string;
  idempotencyKey: string;
};

export type WalletGrant = WalletRequest & {
  orderId: string;
  sourceKey: string;
  amountToman: number;
  expiresAt: Date;
} & (
    | { source: WalletSource; policyVersion: number; referralPolicyVersion?: never }
    | { source: 'REFERRAL'; referralPolicyVersion: number; policyVersion?: never }
  );

export type WalletLotRequest = WalletRequest & { lotId: string };
export type WalletReserve = WalletRequest & { orderId: string; amountToman: number };
export type WalletReservationRequest = WalletRequest & { reservationId: string };
export type WalletCorrection = { actorUserId: string; reason: string };
export type WalletReverseGrant = WalletLotRequest & {
  amountToman: number;
} & Partial<WalletCorrection>;
export type WalletReverseCapture = WalletReservationRequest & {
  amountToman: number;
} & Partial<WalletCorrection>;

export function allocateWalletAmount<T extends { capacity: number }>(
  sources: readonly T[],
  amount: number,
) {
  const allocations: { source: T; amount: number }[] = [];
  let unallocated = amount;
  for (const source of sources) {
    const used = Math.min(Math.max(0, source.capacity), unallocated);
    if (used > 0) allocations.push({ source, amount: used });
    unallocated -= used;
    if (unallocated === 0) break;
  }
  return unallocated === 0 ? allocations : null;
}

export function returnedWalletBucket(now: Date, expiresAt: Date) {
  return expiresAt > now ? 'AVAILABLE' : 'EXPIRED';
}
