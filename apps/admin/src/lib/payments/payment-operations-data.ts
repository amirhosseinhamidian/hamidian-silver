import 'server-only';

import { cookies } from 'next/headers';

import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { requestAdminCatalog, readJsonResponse } from '@/lib/catalog/catalog-api';
import {
  parsePaymentInitiationCandidates,
  parsePaymentOperationsSummary,
  parsePaymentReconciliations,
  type PaymentInitiationCandidate,
  type PaymentOperationsSummary,
  type PaymentReconciliation,
} from '@/lib/payments/payment-operations-model';

export type PaymentOperationsData = Readonly<{
  summary: PaymentOperationsSummary | null;
  initiations: readonly PaymentInitiationCandidate[];
  reconciliations: readonly PaymentReconciliation[];
  failed: boolean;
}>;

export async function loadPaymentOperations(): Promise<PaymentOperationsData> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) throw new Error('Authenticated admin session is required.');
  try {
    const [summaryResponse, initiationResponse, reconciliationResponse] = await Promise.all([
      requestAdminCatalog('/api/v1/payments/operations/summary', token),
      requestAdminCatalog('/api/v1/payments/initiation-recovery', token),
      requestAdminCatalog('/api/v1/payments/reconciliations?status=OPEN', token),
    ]);
    if (!summaryResponse.ok || !initiationResponse.ok || !reconciliationResponse.ok) {
      return { summary: null, initiations: [], reconciliations: [], failed: true };
    }
    const [summary, initiations, reconciliations] = await Promise.all([
      readJsonResponse(summaryResponse).then(parsePaymentOperationsSummary),
      readJsonResponse(initiationResponse).then(parsePaymentInitiationCandidates),
      readJsonResponse(reconciliationResponse).then(parsePaymentReconciliations),
    ]);
    return {
      summary,
      initiations: initiations ?? [],
      reconciliations: reconciliations ?? [],
      failed: !summary || !initiations || !reconciliations,
    };
  } catch {
    return { summary: null, initiations: [], reconciliations: [], failed: true };
  }
}
