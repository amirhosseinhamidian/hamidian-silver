export type AdminSupplierImportStatus = 'PENDING_REVIEW' | 'REVIEWED' | 'REJECTED' | 'IMPORTED';
export type AdminSupplierCrawlRunStatus =
  'QUEUED' | 'RUNNING' | 'PAUSED' | 'SUCCEEDED' | 'PARTIAL' | 'FAILED' | 'CANCELLED';

export type AdminSupplierImportAttribute = Readonly<{ key: string; value: string }>;

export type AdminSupplierImportSource = Readonly<{
  id: string;
  name: string;
  baseUrl: string;
  hostname: string;
  adapterKey: string | null;
  supplierName: string;
  supplierCode: string;
  supported: boolean;
  lastRunStatus: string | null;
  lastRunAt: string | null;
}>;

export type AdminSupplierImportDraft = Readonly<{
  id: string;
  sourceProductKey: string;
  sourceUrl: string;
  sourceSku: string | null;
  title: string;
  description: string | null;
  sourceCategory: string | null;
  supplierRetailPriceToman: number | null;
  sourceAvailability: 'UNKNOWN' | 'IN_STOCK' | 'OUT_OF_STOCK';
  catalogCategoryId: string | null;
  weightGrams: number | null;
  attributes: readonly AdminSupplierImportAttribute[];
  imageUrls: readonly string[];
  status: AdminSupplierImportStatus;
  product: Readonly<{ id: string; name: string; slug: string; status: string }> | null;
  importedAt: string | null;
  importedBy: string | null;
  lastCrawledAt: string;
  updatedAt: string;
  source: Readonly<{
    id: string;
    name: string;
    hostname: string;
    supplierName: string;
    supplierCode: string;
  }>;
  reviewedBy: string | null;
}>;

export type AdminSupplierSourceCategory = Readonly<{
  id: string;
  supplierSourceId: string;
  externalKey: string;
  name: string;
  url: string;
  catalogCategoryId: string | null;
  catalogCategoryName: string | null;
}>;

export type AdminSupplierCatalogCategory = Readonly<{ id: string; name: string }>;

export type AdminSupplierSourceChange = Readonly<{
  id: string;
  type: 'PRICE' | 'AVAILABILITY';
  previousValue: string | null;
  newValue: string | null;
  createdAt: string;
  draftId: string;
  draftTitle: string;
  sourceUrl: string;
  supplierName: string;
  productId: string | null;
  productName: string | null;
}>;

export type AdminSupplierCrawlIssue = Readonly<{
  id: string;
  sourceUrl: string;
  errorMessage: string;
  createdAt: string;
}>;

export type AdminSupplierCrawlRun = Readonly<{
  id: string;
  supplierSourceId: string;
  sourceName: string;
  supplierName: string;
  categoryName: string | null;
  isScheduled: boolean;
  scheduledCategoryIds: readonly string[];
  issues: readonly AdminSupplierCrawlIssue[];
  status: AdminSupplierCrawlRunStatus;
  requestedLimit: number | null;
  currentPage: number;
  discoveredCount: number;
  succeededCount: number;
  failedCount: number;
  skippedCount: number;
  stopAtKnown: boolean;
  monitorKnownProducts: boolean;
  errorMessage: string | null;
  archivedAt: string | null;
  archivedBy: string | null;
  createdAt: string;
}>;

export type AdminSupplierCrawlSchedule = Readonly<{
  id: string;
  supplierSourceId: string;
  categoryIds: readonly string[];
  isEnabled: boolean;
  timeOfDay: string;
  timezone: string;
  requestedLimit: number;
  stopAtKnown: boolean;
  monitorKnownProducts: boolean;
  maxRetries: number;
  retryDelayMinutes: number;
  nextRunAt: string | null;
  lastEnqueuedAt: string | null;
  lastFinishedAt: string | null;
  lastRun: Readonly<{
    id: string;
    status: AdminSupplierCrawlRunStatus;
    createdAt: string;
    finishedAt: string | null;
  }> | null;
}>;

export type AdminSupplierImportPage<T> = Readonly<{
  items: readonly T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}>;

export type AdminSupplierImportFilters = Readonly<{
  status: AdminSupplierImportStatus | 'ALL';
  supplierSourceId: string | 'ALL';
  page: number;
  pageSize: number;
  runPage: number;
  runPageSize: number;
  historyPage: number;
  historyPageSize: number;
  showHistory: boolean;
}>;

export type AdminSupplierImportsData = Readonly<{
  sources: readonly AdminSupplierImportSource[];
  drafts: AdminSupplierImportPage<AdminSupplierImportDraft>;
  categories: readonly AdminSupplierSourceCategory[];
  runs: AdminSupplierImportPage<AdminSupplierCrawlRun>;
  archivedRuns: AdminSupplierImportPage<AdminSupplierCrawlRun>;
  schedules: readonly AdminSupplierCrawlSchedule[];
  catalogCategories: readonly AdminSupplierCatalogCategory[];
  sourceChanges: readonly AdminSupplierSourceChange[];
}>;

const STATUSES = new Set<AdminSupplierImportStatus>([
  'PENDING_REVIEW',
  'REVIEWED',
  'REJECTED',
  'IMPORTED',
]);
const RUN_STATUSES = new Set<AdminSupplierCrawlRunStatus>([
  'QUEUED',
  'RUNNING',
  'PAUSED',
  'SUCCEEDED',
  'PARTIAL',
  'FAILED',
  'CANCELLED',
]);

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function number(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function parseSupplierImportSources(
  value: unknown,
): readonly AdminSupplierImportSource[] | null {
  if (!Array.isArray(value)) return null;
  const parsed = value.map((entry) => {
    const item = record(entry);
    const supplier = record(item?.supplier);
    const runs = Array.isArray(item?.crawlRuns) ? item.crawlRuns : [];
    const lastRun = record(runs[0]);
    const id = text(item?.id);
    const name = text(item?.name);
    const baseUrl = text(item?.baseUrl);
    const hostname = text(item?.hostname);
    const supplierName = text(supplier?.name);
    const supplierCode = text(supplier?.code);
    if (!id || !name || !baseUrl || !hostname || !supplierName || !supplierCode) return null;
    const adapterKey = text(item?.adapterKey);
    return {
      id,
      name,
      baseUrl,
      hostname,
      adapterKey,
      supplierName,
      supplierCode,
      supported: adapterKey === 'bsj-silver',
      lastRunStatus: text(lastRun?.status),
      lastRunAt: text(lastRun?.createdAt),
    } satisfies AdminSupplierImportSource;
  });
  return parsed.some((item) => item === null)
    ? null
    : (parsed as readonly AdminSupplierImportSource[]);
}

export function parseSupplierImportDrafts(
  value: unknown,
): readonly AdminSupplierImportDraft[] | null {
  if (!Array.isArray(value)) return null;
  const parsed = value.map((entry) => {
    const item = record(entry);
    const source = record(item?.supplierSource);
    const supplier = record(source?.supplier);
    const reviewer = record(item?.reviewedBy);
    const importer = record(item?.importedBy);
    const product = record(item?.product);
    const sourceCategoryRecord = record(item?.sourceCategoryRecord);
    const status = text(item?.status) as AdminSupplierImportStatus | null;
    const rawAttributes = Array.isArray(item?.attributes) ? item.attributes : [];
    const attributes = rawAttributes.map((attribute) => {
      const pair = record(attribute);
      const key = text(pair?.key);
      const valueText = text(pair?.value);
      return key && valueText ? { key, value: valueText } : null;
    });
    const imageUrls = Array.isArray(item?.imageUrls)
      ? item.imageUrls.filter(
          (url): url is string => typeof url === 'string' && Boolean(url.trim()),
        )
      : [];
    const id = text(item?.id);
    const sourceProductKey = text(item?.sourceProductKey);
    const sourceUrl = text(item?.sourceUrl);
    const title = text(item?.title);
    const lastCrawledAt = text(item?.lastCrawledAt);
    const updatedAt = text(item?.updatedAt);
    const sourceId = text(source?.id);
    const sourceName = text(source?.name);
    const hostname = text(source?.hostname);
    const supplierName = text(supplier?.name);
    const supplierCode = text(supplier?.code);
    if (
      !id ||
      !sourceProductKey ||
      !sourceUrl ||
      !title ||
      !status ||
      !STATUSES.has(status) ||
      !lastCrawledAt ||
      !updatedAt ||
      !sourceId ||
      !sourceName ||
      !hostname ||
      !supplierName ||
      !supplierCode ||
      attributes.some((attribute) => attribute === null) ||
      imageUrls.length !== (Array.isArray(item?.imageUrls) ? item.imageUrls.length : 0)
    ) {
      return null;
    }
    const reviewerName = [text(reviewer?.firstName), text(reviewer?.lastName)]
      .filter(Boolean)
      .join(' ');
    const importerName = [text(importer?.firstName), text(importer?.lastName)]
      .filter(Boolean)
      .join(' ');
    const productId = text(product?.id);
    const productName = text(product?.name);
    const productSlug = text(product?.slug);
    const productStatus = text(product?.status);
    return {
      id,
      sourceProductKey,
      sourceUrl,
      sourceSku: text(item?.sourceSku),
      title,
      description: text(item?.description),
      sourceCategory: text(item?.sourceCategory),
      supplierRetailPriceToman: number(item?.supplierRetailPriceToman),
      sourceAvailability:
        item?.sourceAvailability === 'IN_STOCK' || item?.sourceAvailability === 'OUT_OF_STOCK'
          ? item.sourceAvailability
          : 'UNKNOWN',
      catalogCategoryId: text(sourceCategoryRecord?.catalogCategoryId),
      weightGrams: number(item?.weightGrams),
      attributes: attributes as readonly AdminSupplierImportAttribute[],
      imageUrls,
      status,
      product:
        productId && productName && productSlug && productStatus
          ? { id: productId, name: productName, slug: productSlug, status: productStatus }
          : null,
      importedAt: text(item?.importedAt),
      importedBy: importerName || text(importer?.phone),
      lastCrawledAt,
      updatedAt,
      source: {
        id: sourceId,
        name: sourceName,
        hostname,
        supplierName,
        supplierCode,
      },
      reviewedBy: reviewerName || text(reviewer?.phone),
    } satisfies AdminSupplierImportDraft;
  });
  return parsed.some((item) => item === null)
    ? null
    : (parsed as readonly AdminSupplierImportDraft[]);
}

function parsePage<T>(
  value: unknown,
  parseItems: (value: unknown) => readonly T[] | null,
): AdminSupplierImportPage<T> | null {
  const source = record(value);
  const items = parseItems(source?.items);
  const total = number(source?.total);
  const page = number(source?.page);
  const pageSize = number(source?.pageSize);
  const totalPages = number(source?.totalPages);
  if (
    !items ||
    total === null ||
    page === null ||
    pageSize === null ||
    totalPages === null ||
    total < 0 ||
    page < 1 ||
    pageSize < 1 ||
    totalPages < 1
  ) {
    return null;
  }
  return { items, total, page, pageSize, totalPages };
}

export function parseSupplierImportDraftPage(
  value: unknown,
): AdminSupplierImportPage<AdminSupplierImportDraft> | null {
  return parsePage(value, parseSupplierImportDrafts);
}

export function parseSupplierSourceCategories(
  value: unknown,
): readonly AdminSupplierSourceCategory[] | null {
  if (!Array.isArray(value)) return null;
  const parsed = value.map((entry) => {
    const item = record(entry);
    const id = text(item?.id);
    const supplierSourceId = text(item?.supplierSourceId);
    const externalKey = text(item?.externalKey);
    const name = text(item?.name);
    const url = text(item?.url);
    const catalogCategory = record(item?.catalogCategory);
    return id && supplierSourceId && externalKey && name && url
      ? {
          id,
          supplierSourceId,
          externalKey,
          name,
          url,
          catalogCategoryId: text(item?.catalogCategoryId),
          catalogCategoryName: text(catalogCategory?.name),
        }
      : null;
  });
  return parsed.some((item) => item === null)
    ? null
    : (parsed as readonly AdminSupplierSourceCategory[]);
}

export function parseSupplierCrawlRuns(value: unknown): readonly AdminSupplierCrawlRun[] | null {
  if (!Array.isArray(value)) return null;
  const parsed = value.map((entry) => {
    const item = record(entry);
    const source = record(item?.supplierSource);
    const supplier = record(source?.supplier);
    const category = record(item?.category);
    const schedule = record(item?.schedule);
    const status = text(item?.status) as AdminSupplierCrawlRunStatus | null;
    const id = text(item?.id);
    const supplierSourceId = text(item?.supplierSourceId);
    const sourceName = text(source?.name);
    const supplierName = text(supplier?.name);
    const createdAt = text(item?.createdAt);
    const currentPage = number(item?.currentPage);
    const discoveredCount = number(item?.discoveredCount);
    const succeededCount = number(item?.succeededCount);
    const failedCount = number(item?.failedCount);
    const skippedCount = number(item?.skippedCount);
    const rawIssues = Array.isArray(item?.issues) ? item.issues : [];
    const issues = rawIssues.map((entry) => {
      const issue = record(entry);
      const issueId = text(issue?.id);
      const sourceUrl = text(issue?.sourceUrl);
      const errorMessage = text(issue?.errorMessage);
      const issueCreatedAt = text(issue?.createdAt);
      return issueId && sourceUrl && errorMessage && issueCreatedAt
        ? { id: issueId, sourceUrl, errorMessage, createdAt: issueCreatedAt }
        : null;
    });
    if (
      !id ||
      !supplierSourceId ||
      !sourceName ||
      !supplierName ||
      !status ||
      !RUN_STATUSES.has(status) ||
      !createdAt ||
      currentPage === null ||
      discoveredCount === null ||
      succeededCount === null ||
      failedCount === null ||
      skippedCount === null ||
      issues.some((issue) => issue === null)
    ) {
      return null;
    }
    return {
      id,
      supplierSourceId,
      sourceName,
      supplierName,
      categoryName: text(category?.name),
      isScheduled: text(item?.scope) === 'SCHEDULED' || Boolean(text(item?.scheduleId)),
      scheduledCategoryIds: Array.isArray(schedule?.categoryIds)
        ? schedule.categoryIds.filter(
            (categoryId): categoryId is string => typeof categoryId === 'string',
          )
        : [],
      issues: issues as readonly AdminSupplierCrawlIssue[],
      status,
      requestedLimit: number(item?.requestedLimit),
      currentPage,
      discoveredCount,
      succeededCount,
      failedCount,
      skippedCount,
      stopAtKnown: item?.stopAtKnown === true,
      monitorKnownProducts: item?.monitorKnownProducts === true,
      errorMessage: text(item?.errorMessage),
      archivedAt: text(item?.archivedAt),
      archivedBy:
        [text(record(item?.archivedBy)?.firstName), text(record(item?.archivedBy)?.lastName)]
          .filter(Boolean)
          .join(' ') || text(record(item?.archivedBy)?.phone),
      createdAt,
    } satisfies AdminSupplierCrawlRun;
  });
  return parsed.some((item) => item === null) ? null : (parsed as readonly AdminSupplierCrawlRun[]);
}

export function parseSupplierCatalogCategories(
  value: unknown,
): readonly AdminSupplierCatalogCategory[] | null {
  if (!Array.isArray(value)) return null;
  const parsed = value.map((entry) => {
    const item = record(entry);
    const id = text(item?.id);
    const name = text(item?.name);
    return id && name ? { id, name } : null;
  });
  return parsed.some((item) => item === null)
    ? null
    : (parsed as readonly AdminSupplierCatalogCategory[]);
}

export function parseSupplierSourceChanges(
  value: unknown,
): readonly AdminSupplierSourceChange[] | null {
  if (!Array.isArray(value)) return null;
  const parsed = value.map((entry) => {
    const item = record(entry);
    const draft = record(item?.draft);
    const product = record(draft?.product);
    const supplierSource = record(draft?.supplierSource);
    const supplier = record(supplierSource?.supplier);
    const id = text(item?.id);
    const type = text(item?.type);
    const createdAt = text(item?.createdAt);
    const draftId = text(draft?.id);
    const draftTitle = text(draft?.title);
    const sourceUrl = text(draft?.sourceUrl);
    const supplierName = text(supplier?.name);
    if (
      !id ||
      !createdAt ||
      !draftId ||
      !draftTitle ||
      !sourceUrl ||
      !supplierName ||
      (type !== 'PRICE' && type !== 'AVAILABILITY')
    ) {
      return null;
    }
    return {
      id,
      type,
      previousValue: text(item?.previousValue),
      newValue: text(item?.newValue),
      createdAt,
      draftId,
      draftTitle,
      sourceUrl,
      supplierName,
      productId: text(product?.id),
      productName: text(product?.name),
    } satisfies AdminSupplierSourceChange;
  });
  return parsed.some((item) => item === null)
    ? null
    : (parsed as readonly AdminSupplierSourceChange[]);
}

export function parseSupplierCrawlRunPage(
  value: unknown,
): AdminSupplierImportPage<AdminSupplierCrawlRun> | null {
  return parsePage(value, parseSupplierCrawlRuns);
}

export function parseSupplierCrawlSchedules(
  value: unknown,
): readonly AdminSupplierCrawlSchedule[] | null {
  if (!Array.isArray(value)) return null;
  const parsed = value.map((entry) => {
    const item = record(entry);
    const runs = Array.isArray(item?.crawlRuns) ? item.crawlRuns : [];
    const rawLastRun = record(runs[0]);
    const id = text(item?.id);
    const supplierSourceId = text(item?.supplierSourceId);
    const timeOfDay = text(item?.timeOfDay);
    const timezone = text(item?.timezone);
    const requestedLimit = number(item?.requestedLimit);
    const maxRetries = number(item?.maxRetries);
    const retryDelayMinutes = number(item?.retryDelayMinutes);
    const categoryIds = Array.isArray(item?.categoryIds)
      ? item.categoryIds.filter((categoryId): categoryId is string => Boolean(text(categoryId)))
      : [];
    if (
      !id ||
      !supplierSourceId ||
      !timeOfDay ||
      !timezone ||
      requestedLimit === null ||
      maxRetries === null ||
      retryDelayMinutes === null ||
      categoryIds.length !== (Array.isArray(item?.categoryIds) ? item.categoryIds.length : 0)
    ) {
      return null;
    }
    const lastRunStatus = text(rawLastRun?.status) as AdminSupplierCrawlRunStatus | null;
    const lastRunId = text(rawLastRun?.id);
    const lastRunCreatedAt = text(rawLastRun?.createdAt);
    return {
      id,
      supplierSourceId,
      categoryIds,
      isEnabled: item?.isEnabled === true,
      timeOfDay,
      timezone,
      requestedLimit,
      stopAtKnown: item?.stopAtKnown === true,
      monitorKnownProducts: item?.monitorKnownProducts === true,
      maxRetries,
      retryDelayMinutes,
      nextRunAt: text(item?.nextRunAt),
      lastEnqueuedAt: text(item?.lastEnqueuedAt),
      lastFinishedAt: text(item?.lastFinishedAt),
      lastRun:
        lastRunId && lastRunStatus && RUN_STATUSES.has(lastRunStatus) && lastRunCreatedAt
          ? {
              id: lastRunId,
              status: lastRunStatus,
              createdAt: lastRunCreatedAt,
              finishedAt: text(rawLastRun?.finishedAt),
            }
          : null,
    } satisfies AdminSupplierCrawlSchedule;
  });
  return parsed.some((item) => item === null)
    ? null
    : (parsed as readonly AdminSupplierCrawlSchedule[]);
}

function queryText(value: string | string[] | undefined): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function positiveInteger(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function parseSupplierImportFilters(
  value: Record<string, string | string[] | undefined>,
): AdminSupplierImportFilters {
  const rawStatus = queryText(value.status);
  const status = STATUSES.has(rawStatus as AdminSupplierImportStatus)
    ? (rawStatus as AdminSupplierImportStatus)
    : 'ALL';
  const requestedPageSize = positiveInteger(queryText(value.pageSize), 24);
  const requestedHistoryPageSize = positiveInteger(queryText(value.historyPageSize), 10);
  return {
    status,
    supplierSourceId: queryText(value.supplierSourceId) ?? 'ALL',
    page: positiveInteger(queryText(value.page), 1),
    pageSize: [12, 24, 48, 96].includes(requestedPageSize) ? requestedPageSize : 24,
    runPage: positiveInteger(queryText(value.runPage), 1),
    runPageSize: 10,
    historyPage: positiveInteger(queryText(value.historyPage), 1),
    historyPageSize: [10, 25, 50].includes(requestedHistoryPageSize)
      ? requestedHistoryPageSize
      : 10,
    showHistory: queryText(value.crawlView) === 'history',
  };
}

export function buildSupplierImportsHref(
  filters: AdminSupplierImportFilters,
  overrides: Partial<AdminSupplierImportFilters> = {},
  hash = '',
): string {
  const next = { ...filters, ...overrides };
  const query = new URLSearchParams();
  if (next.status !== 'ALL') query.set('status', next.status);
  if (next.supplierSourceId !== 'ALL') query.set('supplierSourceId', next.supplierSourceId);
  if (next.page > 1) query.set('page', String(next.page));
  if (next.pageSize !== 24) query.set('pageSize', String(next.pageSize));
  if (next.runPage > 1) query.set('runPage', String(next.runPage));
  if (next.showHistory) query.set('crawlView', 'history');
  if (next.historyPage > 1) query.set('historyPage', String(next.historyPage));
  if (next.historyPageSize !== 10) {
    query.set('historyPageSize', String(next.historyPageSize));
  }
  const suffix = query.toString();
  return `/product-imports${suffix ? `?${suffix}` : ''}${hash}`;
}
