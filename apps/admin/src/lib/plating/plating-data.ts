import 'server-only';

import { cookies } from 'next/headers';

import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { requestAdminCatalog, readJsonResponse } from '@/lib/catalog/catalog-api';
import {
  parsePlatingRates,
  parsePlatingVariants,
  type AdminPlatingRate,
  type AdminPlatingVariant,
} from '@/lib/plating/plating-model';

export type PlatingResource<T> = Readonly<{ data: T | null; failed: boolean }>;

export type PlatingManagementData = Readonly<{
  rates: PlatingResource<readonly AdminPlatingRate[]>;
  variants: PlatingResource<readonly AdminPlatingVariant[]>;
}>;

async function load<T>(
  request: Promise<Response>,
  parse: (value: unknown) => T | null,
): Promise<PlatingResource<T>> {
  try {
    const response = await request;
    if (!response.ok) return { data: null, failed: true };
    const data = parse(await readJsonResponse(response));
    return data === null ? { data: null, failed: true } : { data, failed: false };
  } catch {
    return { data: null, failed: true };
  }
}

export async function loadPlatingManagement(): Promise<PlatingManagementData> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) throw new Error('Authenticated admin session is required.');
  const [rates, variants] = await Promise.all([
    load(requestAdminCatalog('/api/v1/plating/rates', token), parsePlatingRates),
    load(requestAdminCatalog('/api/v1/plating/catalog', token), parsePlatingVariants),
  ]);
  return { rates, variants };
}
