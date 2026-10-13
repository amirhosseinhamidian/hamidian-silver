import 'server-only';

import { cookies } from 'next/headers';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { requestAdminCatalog, readJsonResponse } from '@/lib/catalog/catalog-api';
import {
  parseSupplierImportDrafts,
  parseSupplierImportDraftPage,
  parseSupplierImportSources,
  parseSupplierCrawlRunPage,
  parseSupplierCrawlSchedules,
  parseSupplierCatalogCategories,
  parseSupplierSourceChangePage,
  parseSupplierSourceCategories,
  type AdminSupplierImportFilters,
  type AdminSupplierImportsData,
} from './supplier-imports-model';

export async function loadSupplierImportDraft(draftId: string) {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) throw new Error('Authenticated admin session is required.');
  try {
    const response = await requestAdminCatalog(
      `/api/v1/supplier-imports/drafts/${encodeURIComponent(draftId)}`,
      token,
    );
    if (!response.ok) return null;
    return parseSupplierImportDrafts([await readJsonResponse(response)])?.[0] ?? null;
  } catch {
    return null;
  }
}

export async function loadSupplierImports(filters: AdminSupplierImportFilters): Promise<
  Readonly<{
    data: AdminSupplierImportsData | null;
    failed: boolean;
  }>
> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) throw new Error('Authenticated admin session is required.');
  try {
    const draftQuery = new URLSearchParams({
      page: String(filters.page),
      pageSize: String(filters.pageSize),
    });
    if (filters.status !== 'ALL') draftQuery.set('status', filters.status);
    if (filters.supplierSourceId !== 'ALL') {
      draftQuery.set('supplierSourceId', filters.supplierSourceId);
    }
    const historyQuery = new URLSearchParams({
      view: 'ARCHIVED',
      page: String(filters.historyPage),
      pageSize: String(filters.historyPageSize),
    });
    const changesQuery = new URLSearchParams({
      page: String(filters.changePage),
      pageSize: String(filters.changePageSize),
    });
    const [
      sourcesResponse,
      draftsResponse,
      runsResponse,
      archivedRunsResponse,
      schedulesResponse,
      catalogCategoriesResponse,
      sourceChangesResponse,
    ] = await Promise.all([
      requestAdminCatalog('/api/v1/supplier-imports/sources', token),
      requestAdminCatalog(`/api/v1/supplier-imports/drafts?${draftQuery}`, token),
      requestAdminCatalog(
        `/api/v1/supplier-imports/runs?view=ACTIVE&page=${filters.runPage}&pageSize=${filters.runPageSize}`,
        token,
      ),
      requestAdminCatalog(`/api/v1/supplier-imports/runs?${historyQuery}`, token),
      requestAdminCatalog('/api/v1/supplier-imports/schedules', token),
      requestAdminCatalog('/api/v1/catalog/categories', token),
      requestAdminCatalog(`/api/v1/supplier-imports/changes?${changesQuery}`, token),
    ]);
    if (
      !sourcesResponse.ok ||
      !draftsResponse.ok ||
      !runsResponse.ok ||
      !archivedRunsResponse.ok ||
      !schedulesResponse.ok ||
      !catalogCategoriesResponse.ok ||
      !sourceChangesResponse.ok
    )
      return { data: null, failed: true };
    const sources = parseSupplierImportSources(await readJsonResponse(sourcesResponse));
    const drafts = parseSupplierImportDraftPage(await readJsonResponse(draftsResponse));
    const runs = parseSupplierCrawlRunPage(await readJsonResponse(runsResponse));
    const archivedRuns = parseSupplierCrawlRunPage(await readJsonResponse(archivedRunsResponse));
    const schedules = parseSupplierCrawlSchedules(await readJsonResponse(schedulesResponse));
    const catalogCategories = parseSupplierCatalogCategories(
      await readJsonResponse(catalogCategoriesResponse),
    );
    const sourceChanges = parseSupplierSourceChangePage(
      await readJsonResponse(sourceChangesResponse),
    );
    if (
      !sources ||
      !drafts ||
      !runs ||
      !archivedRuns ||
      !schedules ||
      !catalogCategories ||
      !sourceChanges
    )
      return { data: null, failed: true };
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
      data: {
        sources,
        drafts,
        runs,
        archivedRuns,
        schedules,
        catalogCategories,
        sourceChanges,
        categories: categoryGroups.flatMap((group) => group!),
      },
      failed: false,
    };
  } catch {
    return { data: null, failed: true };
  }
}
