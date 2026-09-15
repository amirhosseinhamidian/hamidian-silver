import 'server-only';

import { cookies } from 'next/headers';

import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { requestAdminCatalog, readJsonResponse } from '@/lib/catalog/catalog-api';
import {
  parsePaymentRefunds,
  parseRefundOrders,
  type AdminPaymentRefund,
  type AdminRefundOrder,
} from '@/lib/refunds/refunds-model';

export type RefundManagementData = Readonly<{
  refunds: readonly AdminPaymentRefund[];
  orders: readonly AdminRefundOrder[];
  failed: boolean;
}>;

export async function loadRefundManagement(): Promise<RefundManagementData> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) throw new Error('Authenticated admin session is required.');

  try {
    const [refundResponse, orderResponse] = await Promise.all([
      requestAdminCatalog('/api/v1/finance/refunds?limit=200', token),
      requestAdminCatalog('/api/v1/finance/orders?limit=100', token),
    ]);
    if (!refundResponse.ok || !orderResponse.ok) {
      return { refunds: [], orders: [], failed: true };
    }

    const [refunds, orders] = await Promise.all([
      readJsonResponse(refundResponse).then(parsePaymentRefunds),
      readJsonResponse(orderResponse).then(parseRefundOrders),
    ]);
    return {
      refunds: refunds ?? [],
      orders: orders ?? [],
      failed: refunds === null || orders === null,
    };
  } catch {
    return { refunds: [], orders: [], failed: true };
  }
}
