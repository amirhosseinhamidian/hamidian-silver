export type AdminSupplierCrawlerType =
  'GENERIC_HTML' | 'JSON_LD' | 'CUSTOM_ADAPTER' | 'API' | 'CSV' | 'XML';

export type AdminSupplierCrawlRun = Readonly<{
  id: string;
  status: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'PARTIAL' | 'FAILED' | 'CANCELLED';
  discoveredCount: number;
  succeededCount: number;
  failedCount: number;
  errorMessage: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}>;

export type AdminSupplierSource = Readonly<{
  id: string;
  name: string;
  baseUrl: string;
  hostname: string;
  crawlerType: AdminSupplierCrawlerType;
  adapterKey: string | null;
  crawlDelayMs: number;
  maxConcurrency: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  lastRun: AdminSupplierCrawlRun | null;
}>;

export type AdminSupplier = Readonly<{
  id: string;
  code: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  active: boolean;
  sources: readonly AdminSupplierSource[];
  createdAt: string;
  updatedAt: string;
}>;

export type AdminProductSupplier = Readonly<{
  supplierId: string;
  supplierName: string;
  supplierCode: string;
  supplierActive: boolean;
  supplierPriceToman: number;
  markupPercent: number | null;
  preferred: boolean;
  active: boolean;
  updatedAt: string;
}>;

export type AdminSupplierProduct = Readonly<{
  id: string;
  name: string;
  slug: string;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  salePriceToman: number | null;
  suppliers: readonly AdminProductSupplier[];
}>;

export type AdminSupplierCatalog = Readonly<{
  suppliers: readonly AdminSupplier[];
  products: readonly AdminSupplierProduct[];
}>;

const PRODUCT_STATUSES = new Set<AdminSupplierProduct['status']>(['DRAFT', 'ACTIVE', 'ARCHIVED']);
const CRAWLER_TYPES = new Set<AdminSupplierCrawlerType>([
  'GENERIC_HTML',
  'JSON_LD',
  'CUSTOM_ADAPTER',
  'API',
  'CSV',
  'XML',
]);
const CRAWL_STATUSES = new Set<AdminSupplierCrawlRun['status']>([
  'QUEUED',
  'RUNNING',
  'SUCCEEDED',
  'PARTIAL',
  'FAILED',
  'CANCELLED',
]);

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function number(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseCrawlRun(value: unknown): AdminSupplierCrawlRun | null {
  const item = record(value);
  const id = text(item?.id);
  const status = text(item?.status) as AdminSupplierCrawlRun['status'] | null;
  const createdAt = text(item?.createdAt);
  const discoveredCount = number(item?.discoveredCount);
  const succeededCount = number(item?.succeededCount);
  const failedCount = number(item?.failedCount);
  if (
    !id ||
    !status ||
    !CRAWL_STATUSES.has(status) ||
    !createdAt ||
    discoveredCount === null ||
    succeededCount === null ||
    failedCount === null
  ) {
    return null;
  }
  return {
    id,
    status,
    discoveredCount,
    succeededCount,
    failedCount,
    errorMessage: text(item?.errorMessage),
    startedAt: text(item?.startedAt),
    finishedAt: text(item?.finishedAt),
    createdAt,
  };
}

function parseSupplierSource(value: unknown): AdminSupplierSource | null {
  const item = record(value);
  const id = text(item?.id);
  const name = text(item?.name);
  const baseUrl = text(item?.baseUrl);
  const hostname = text(item?.hostname);
  const crawlerType = text(item?.crawlerType) as AdminSupplierCrawlerType | null;
  const crawlDelayMs = number(item?.crawlDelayMs);
  const maxConcurrency = number(item?.maxConcurrency);
  const createdAt = text(item?.createdAt);
  const updatedAt = text(item?.updatedAt);
  const rawRuns = Array.isArray(item?.crawlRuns) ? item.crawlRuns : [];
  const lastRun = rawRuns.length ? parseCrawlRun(rawRuns[0]) : null;
  if (
    !id ||
    !name ||
    !baseUrl ||
    !hostname ||
    !crawlerType ||
    !CRAWLER_TYPES.has(crawlerType) ||
    crawlDelayMs === null ||
    maxConcurrency === null ||
    !createdAt ||
    !updatedAt ||
    (rawRuns.length > 0 && lastRun === null)
  ) {
    return null;
  }
  return {
    id,
    name,
    baseUrl,
    hostname,
    crawlerType,
    adapterKey: text(item?.adapterKey),
    crawlDelayMs,
    maxConcurrency,
    active: item?.isActive !== false,
    createdAt,
    updatedAt,
    lastRun,
  };
}

function parseSupplier(value: unknown): AdminSupplier | null {
  const item = record(value);
  const id = text(item?.id);
  const code = text(item?.code);
  const name = text(item?.name);
  const createdAt = text(item?.createdAt);
  const updatedAt = text(item?.updatedAt);
  const rawSources = Array.isArray(item?.sources) ? item.sources : [];
  const sources = rawSources
    .map(parseSupplierSource)
    .filter((source): source is AdminSupplierSource => source !== null);
  if (!id || !code || !name || !createdAt || !updatedAt) return null;
  if (sources.length !== rawSources.length) return null;
  return {
    id,
    code,
    name,
    contactName: text(item?.contactName),
    phone: text(item?.phone),
    active: item?.isActive !== false,
    sources,
    createdAt,
    updatedAt,
  };
}

function parseProductSupplier(value: unknown): AdminProductSupplier | null {
  const item = record(value);
  const supplier = record(item?.supplier);
  const supplierId = text(item?.supplierId);
  const supplierName = text(supplier?.name);
  const supplierCode = text(supplier?.code);
  const price = number(item?.supplierPriceToman);
  const updatedAt = text(item?.updatedAt);
  if (!supplierId || !supplierName || !supplierCode || price === null || !updatedAt) return null;
  return {
    supplierId,
    supplierName,
    supplierCode,
    supplierActive: supplier?.isActive !== false,
    supplierPriceToman: price,
    markupPercent: number(item?.markupPercent),
    preferred: item?.isPreferred === true,
    active: item?.isActive !== false,
    updatedAt,
  };
}

function parseProduct(value: unknown): AdminSupplierProduct | null {
  const item = record(value);
  const id = text(item?.id);
  const name = text(item?.name);
  const slug = text(item?.slug);
  const status = text(item?.status) as AdminSupplierProduct['status'] | null;
  const rawSuppliers = item?.suppliers;
  if (
    !id ||
    !name ||
    !slug ||
    !status ||
    !PRODUCT_STATUSES.has(status) ||
    !Array.isArray(rawSuppliers)
  ) {
    return null;
  }
  const suppliers = rawSuppliers
    .map(parseProductSupplier)
    .filter((supplier): supplier is AdminProductSupplier => supplier !== null);
  if (suppliers.length !== rawSuppliers.length) return null;
  return {
    id,
    name,
    slug,
    status,
    salePriceToman: number(item?.salePriceToman),
    suppliers,
  };
}

export function parseSupplierCatalog(value: unknown): AdminSupplierCatalog | null {
  const root = record(value);
  if (!Array.isArray(root?.suppliers) || !Array.isArray(root?.products)) return null;
  const suppliers = root.suppliers
    .map(parseSupplier)
    .filter((supplier): supplier is AdminSupplier => supplier !== null);
  const products = root.products
    .map(parseProduct)
    .filter((product): product is AdminSupplierProduct => product !== null);
  if (suppliers.length !== root.suppliers.length || products.length !== root.products.length) {
    return null;
  }
  return { suppliers, products };
}

export function preferredSupplier(product: AdminSupplierProduct): AdminProductSupplier | null {
  return (
    product.suppliers.find(
      (supplier) => supplier.preferred && supplier.active && supplier.supplierActive,
    ) ?? null
  );
}
