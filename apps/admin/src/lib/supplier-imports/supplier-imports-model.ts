export type AdminSupplierImportStatus = 'PENDING_REVIEW' | 'REVIEWED' | 'REJECTED';

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
  weightGrams: number | null;
  attributes: readonly AdminSupplierImportAttribute[];
  imageUrls: readonly string[];
  status: AdminSupplierImportStatus;
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

export type AdminSupplierImportsData = Readonly<{
  sources: readonly AdminSupplierImportSource[];
  drafts: readonly AdminSupplierImportDraft[];
}>;

const STATUSES = new Set<AdminSupplierImportStatus>(['PENDING_REVIEW', 'REVIEWED', 'REJECTED']);

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
    return {
      id,
      sourceProductKey,
      sourceUrl,
      sourceSku: text(item?.sourceSku),
      title,
      description: text(item?.description),
      sourceCategory: text(item?.sourceCategory),
      supplierRetailPriceToman: number(item?.supplierRetailPriceToman),
      weightGrams: number(item?.weightGrams),
      attributes: attributes as readonly AdminSupplierImportAttribute[],
      imageUrls,
      status,
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
