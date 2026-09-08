import 'server-only';

import { cookies } from 'next/headers';

import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { requestAdminCatalog, readJsonResponse } from '@/lib/catalog/catalog-api';
import {
  parsePaymentInitiationCandidates,
  parsePaymentOperationsSummary,
  type PaymentInitiationCandidate,
  type PaymentOperationsSummary,
} from '@/lib/payments/payment-operations-model';
import {
  parsePaymentAttemptPage,
  type AdminPaymentAttempt,
} from '@/lib/transactions/payment-transactions-model';

export type PaymentRecoveryData = Readonly<{
  summary: PaymentOperationsSummary | null;
  candidates: readonly PaymentInitiationCandidate[];
  history: readonly AdminPaymentAttempt[];
  failed: boolean;
}>;

export async function loadPaymentRecovery(): Promise<PaymentRecoveryData> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) throw new Error('Authenticated admin session is required.');

  try {
    const [summaryResponse, candidatesResponse, attemptsResponse] = await Promise.all([
      requestAdminCatalog('/api/v1/payments/operations/summary', token),
      requestAdminCatalog('/api/v1/payments/initiation-recovery', token),
      requestAdminCatalog('/api/v1/payments/attempts?page=1&pageSize=100', token),
    ]);
    if (!summaryResponse.ok || !candidatesResponse.ok || !attemptsResponse.ok) {
      return { summary: null, candidates: [], history: [], failed: true };
    }

    const [summary, candidates, attempts] = await Promise.all([
      readJsonResponse(summaryResponse).then(parsePaymentOperationsSummary),
      readJsonResponse(candidatesResponse).then(parsePaymentInitiationCandidates),
      readJsonResponse(attemptsResponse).then(parsePaymentAttemptPage),
    ]);
    return {
      summary,
      candidates: candidates ?? [],
      history:
        attempts?.items.filter((attempt) => attempt.initiationRecoveryResolution !== null) ?? [],
      failed: summary === null || candidates === null || attempts === null,
    };
  } catch {
    return { summary: null, candidates: [], history: [], failed: true };
  }
}
