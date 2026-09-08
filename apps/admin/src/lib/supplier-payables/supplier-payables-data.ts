import 'server-only';

import { cookies } from 'next/headers';

import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { requestAdminCatalog, readJsonResponse } from '@/lib/catalog/catalog-api';
import {
  parseSupplierPayables,
  parseSupplierPayableSummary,
  type AdminSupplierPayable,
  type AdminSupplierPayableSummary,
} from '@/lib/supplier-payables/supplier-payables-model';

export type SupplierPayablesData = Readonly<{
  payables: readonly AdminSupplierPayable[];
  summary: readonly AdminSupplierPayableSummary[];
  failed: boolean;
}>;

export async function loadSupplierPayables(): Promise<SupplierPayablesData> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) throw new Error('Authenticated admin session is required.');
  try {
    const [openResponse, paidResponse, summaryResponse] = await Promise.all([
      requestAdminCatalog('/api/v1/finance/supplier-payables?status=OPEN&limit=200', token),
      requestAdminCatalog('/api/v1/finance/supplier-payables?status=PAID&limit=200', token),
      requestAdminCatalog('/api/v1/finance/supplier-payables/summary', token),
    ]);
    const [open, paid, summary] = await Promise.all([
      openResponse.ok
        ? readJsonResponse(openResponse).then(parseSupplierPayables)
        : Promise.resolve(null),
      paidResponse.ok
        ? readJsonResponse(paidResponse).then(parseSupplierPayables)
        : Promise.resolve(null),
      summaryResponse.ok
        ? readJsonResponse(summaryResponse).then(parseSupplierPayableSummary)
        : Promise.resolve(null),
    ]);
    if (!open || !paid || !summary) return { payables: [], summary: [], failed: true };
    return { payables: [...open, ...paid], summary, failed: false };
  } catch {
    return { payables: [], summary: [], failed: true };
  }
}
