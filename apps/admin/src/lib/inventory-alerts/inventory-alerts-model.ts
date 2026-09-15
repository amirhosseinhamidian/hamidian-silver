export type AdminStockNotificationTotals = Readonly<{
  active: number;
  queued: number;
  notified: number;
  cancelled: number;
}>;

export type AdminStockNotificationTarget = Readonly<{
  id: string;
  productId: string;
  productName: string;
  productSlug: string;
  productStatus: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  variantId: string | null;
  sku: string | null;
  variantName: string | null;
  sizeLabel: string | null;
  variantActive: boolean;
  activeCount: number;
  queuedCount: number;
  notifiedCount: number;
  cancelledCount: number;
  lastRequestedAt: string | null;
  lastNotifiedAt: string | null;
}>;

export type AdminStockNotificationSummary = Readonly<{
  totals: AdminStockNotificationTotals;
  targets: readonly AdminStockNotificationTarget[];
}>;

const PRODUCT_STATUSES = new Set<AdminStockNotificationTarget['productStatus']>([
  'DRAFT',
  'ACTIVE',
  'ARCHIVED',
]);

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function count(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
}

function parseTarget(value: unknown): AdminStockNotificationTarget | null {
  const item = record(value);
  const product = record(item?.product);
  const variant = record(item?.variant);
  const productId = text(item?.productId);
  const productName = text(product?.name);
  const productSlug = text(product?.slug);
  const productStatus = text(product?.status) as
    AdminStockNotificationTarget['productStatus'] | null;
  const variantId = text(item?.variantId);
  const activeCount = count(item?.activeCount);
  const queuedCount = count(item?.queuedCount);
  const notifiedCount = count(item?.notifiedCount);
  const cancelledCount = count(item?.cancelledCount);
  if (
    !productId ||
    !productName ||
    !productSlug ||
    !productStatus ||
    !PRODUCT_STATUSES.has(productStatus) ||
    activeCount === null ||
    queuedCount === null ||
    notifiedCount === null ||
    cancelledCount === null
  ) {
    return null;
  }
  if (variantId && !variant) return null;
  return {
    id: `${productId}:${variantId ?? 'product'}`,
    productId,
    productName,
    productSlug,
    productStatus,
    variantId,
    sku: text(variant?.sku),
    variantName: text(variant?.name),
    sizeLabel: text(record(variant?.size)?.label),
    variantActive: variantId ? variant?.isActive !== false : true,
    activeCount,
    queuedCount,
    notifiedCount,
    cancelledCount,
    lastRequestedAt: text(item?.lastRequestedAt),
    lastNotifiedAt: text(item?.lastNotifiedAt),
  };
}

export function parseStockNotificationSummary(
  value: unknown,
): AdminStockNotificationSummary | null {
  const root = record(value);
  const totals = record(root?.totals);
  const active = count(totals?.active);
  const queued = count(totals?.queued);
  const notified = count(totals?.notified);
  const cancelled = count(totals?.cancelled);
  const rawTargets = root?.targets;
  if (
    active === null ||
    queued === null ||
    notified === null ||
    cancelled === null ||
    !Array.isArray(rawTargets)
  ) {
    return null;
  }
  const targets = rawTargets
    .map(parseTarget)
    .filter((target): target is AdminStockNotificationTarget => target !== null);
  if (targets.length !== rawTargets.length) return null;
  return { totals: { active, queued, notified, cancelled }, targets };
}
