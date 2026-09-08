import 'server-only';

import { cookies } from 'next/headers';

import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { requestAdminCatalog, readJsonResponse } from '@/lib/catalog/catalog-api';
import {
  parsePaymentReconciliations,
  type PaymentReconciliation,
} from '@/lib/payments/payment-operations-model';

export type PaymentReconciliationData = Readonly<{
  reconciliations: readonly PaymentReconciliation[];
  failed: boolean;
}>;

export async function loadPaymentReconciliations(): Promise<PaymentReconciliationData> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) throw new Error('Authenticated admin session is required.');

  try {
    const response = await requestAdminCatalog('/api/v1/payments/reconciliations', token);
    if (!response.ok) return { reconciliations: [], failed: true };

    const reconciliations = parsePaymentReconciliations(await readJsonResponse(response));
    return {
      reconciliations: reconciliations ?? [],
      failed: reconciliations === null,
    };
  } catch {
    return { reconciliations: [], failed: true };
  }
}
