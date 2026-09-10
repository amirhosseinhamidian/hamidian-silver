import 'server-only';

import { cookies } from 'next/headers';

import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { requestAdminCatalog, readJsonResponse } from '@/lib/catalog/catalog-api';
import {
  parseSupplierCredits,
  type AdminSupplierCredit,
} from '@/lib/supplier-credits/supplier-credits-model';
import {
  parseSupplierPayables,
  type AdminSupplierPayable,
} from '@/lib/supplier-payables/supplier-payables-model';
import {
  parseSupplierSettlements,
  type AdminSupplierSettlement,
} from '@/lib/supplier-settlements/supplier-settlements-model';

export type SupplierSettlementsData = Readonly<{
  settlements: readonly AdminSupplierSettlement[];
  payables: readonly AdminSupplierPayable[];
  credits: readonly AdminSupplierCredit[];
  failed: boolean;
}>;

export async function loadSupplierSettlements(): Promise<SupplierSettlementsData> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) throw new Error('Authenticated admin session is required.');
  try {
    const [settlementsResponse, payablesResponse, creditsResponse] = await Promise.all([
      requestAdminCatalog('/api/v1/finance/supplier-settlements?limit=200', token),
      requestAdminCatalog('/api/v1/finance/supplier-payables?status=OPEN&limit=200', token),
      requestAdminCatalog('/api/v1/finance/supplier-credits?limit=200', token),
    ]);
    if (!settlementsResponse.ok || !payablesResponse.ok || !creditsResponse.ok) {
      return { settlements: [], payables: [], credits: [], failed: true };
    }
    const [settlements, payables, credits] = await Promise.all([
      readJsonResponse(settlementsResponse).then(parseSupplierSettlements),
      readJsonResponse(payablesResponse).then(parseSupplierPayables),
      readJsonResponse(creditsResponse).then(parseSupplierCredits),
    ]);
    if (!settlements || !payables || !credits) {
      return { settlements: [], payables: [], credits: [], failed: true };
    }
    return { settlements, payables, credits, failed: false };
  } catch {
    return { settlements: [], payables: [], credits: [], failed: true };
  }
}
