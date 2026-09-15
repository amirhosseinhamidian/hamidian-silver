import 'server-only';

import { cookies } from 'next/headers';

import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { requestAdminCatalog, readJsonResponse } from '@/lib/catalog/catalog-api';
import {
  parseSupplierCredits,
  type AdminSupplierCredit,
} from '@/lib/supplier-credits/supplier-credits-model';

export type SupplierCreditsData = Readonly<{
  credits: readonly AdminSupplierCredit[];
  failed: boolean;
}>;

export async function loadSupplierCredits(): Promise<SupplierCreditsData> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) throw new Error('Authenticated admin session is required.');
  try {
    const response = await requestAdminCatalog('/api/v1/finance/supplier-credits?limit=200', token);
    if (!response.ok) return { credits: [], failed: true };
    const credits = parseSupplierCredits(await readJsonResponse(response));
    return { credits: credits ?? [], failed: credits === null };
  } catch {
    return { credits: [], failed: true };
  }
}
