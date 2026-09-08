import 'server-only';

import { cookies } from 'next/headers';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { requestAdminCatalog, readJsonResponse } from '@/lib/catalog/catalog-api';
import {
  parsePaymentAttemptPage,
  type AdminPaymentAttemptPage,
} from '@/lib/transactions/payment-transactions-model';

export type PaymentTransactionsData = Readonly<{
  data: AdminPaymentAttemptPage | null;
  failed: boolean;
}>;

export async function loadPaymentTransactions(): Promise<PaymentTransactionsData> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) throw new Error('Authenticated admin session is required.');
  try {
    const response = await requestAdminCatalog(
      '/api/v1/payments/attempts?page=1&pageSize=100',
      token,
    );
    if (!response.ok) return { data: null, failed: true };
    const data = parsePaymentAttemptPage(await readJsonResponse(response));
    return { data, failed: data === null };
  } catch {
    return { data: null, failed: true };
  }
}
