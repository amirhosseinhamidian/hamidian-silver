import 'server-only';

import { cookies } from 'next/headers';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { requestAdminCatalog, readJsonResponse } from '@/lib/catalog/catalog-api';
import {
  parseSupplierImportDrafts,
  parseSupplierImportSources,
  parseSupplierCrawlRuns,
  parseSupplierSourceCategories,
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
    const [sourcesResponse, draftsResponse, runsResponse] = await Promise.all([
      requestAdminCatalog('/api/v1/supplier-imports/sources', token),
      requestAdminCatalog('/api/v1/supplier-imports/drafts', token),
      requestAdminCatalog('/api/v1/supplier-imports/runs', token),
    ]);
    if (!sourcesResponse.ok || !draftsResponse.ok || !runsResponse.ok)
      return { data: null, failed: true };
    const sources = parseSupplierImportSources(await readJsonResponse(sourcesResponse));
    const drafts = parseSupplierImportDrafts(await readJsonResponse(draftsResponse));
    const runs = parseSupplierCrawlRuns(await readJsonResponse(runsResponse));
    if (!sources || !drafts || !runs) return { data: null, failed: true };
    const categoryResponses = await Promise.all(
      sources
        .filter((source) => source.supported)
        .map((source) =>
          requestAdminCatalog(
            `/api/v1/supplier-imports/categories?supplierSourceId=${encodeURIComponent(source.id)}`,
            token,
          ),
        ),
    );
    if (categoryResponses.some((response) => !response.ok)) return { data: null, failed: true };
    const categoryGroups = await Promise.all(
      categoryResponses.map(async (response) =>
        parseSupplierSourceCategories(await readJsonResponse(response)),
      ),
    );
    if (categoryGroups.some((group) => !group)) return { data: null, failed: true };
    return {
      data: { sources, drafts, runs, categories: categoryGroups.flatMap((group) => group!) },
      failed: false,
    };
  } catch {
    return { data: null, failed: true };
  }
}
