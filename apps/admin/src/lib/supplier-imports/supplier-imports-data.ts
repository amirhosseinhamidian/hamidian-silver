import 'server-only';

import { cookies } from 'next/headers';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { requestAdminCatalog, readJsonResponse } from '@/lib/catalog/catalog-api';
import {
  parseSupplierImportDrafts,
  parseSupplierImportSources,
  type AdminSupplierImportsData,
} from './supplier-imports-model';

export async function loadSupplierImports(): Promise<
  Readonly<{
    data: AdminSupplierImportsData | null;
    failed: boolean;
  }>
> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) throw new Error('Authenticated admin session is required.');
  try {
    const [sourcesResponse, draftsResponse] = await Promise.all([
      requestAdminCatalog('/api/v1/supplier-imports/sources', token),
      requestAdminCatalog('/api/v1/supplier-imports/drafts', token),
    ]);
    if (!sourcesResponse.ok || !draftsResponse.ok) return { data: null, failed: true };
    const sources = parseSupplierImportSources(await readJsonResponse(sourcesResponse));
    const drafts = parseSupplierImportDrafts(await readJsonResponse(draftsResponse));
    if (!sources || !drafts) return { data: null, failed: true };
    return { data: { sources, drafts }, failed: false };
  } catch {
    return { data: null, failed: true };
  }
}
