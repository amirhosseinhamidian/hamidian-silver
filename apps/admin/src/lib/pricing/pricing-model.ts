export type AdminPricingProductStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
export type AdminPricingHistoryKind = 'PRODUCT' | 'PLATING';

export type AdminPricingProduct = Readonly<{
  id: string;
  name: string;
  slug: string;
  status: AdminPricingProductStatus;
  salePriceToman: number | null;
  compareAtPriceToman: number | null;
  supplierCostToman: number | null;
  supplierName: string | null;
}>;

export type AdminPricingRate = Readonly<{
  id: string;
  type: 'GOLD' | 'RHODIUM';
  pricePerGramToman: number;
  leadTimeDays: number;
  active: boolean;
  updatedAt: string;
}>;

export type AdminPricingHistory = Readonly<{
  id: string;
  kind: AdminPricingHistoryKind;
  title: string;
  previousPriceToman: number | null;
  newPriceToman: number;
  previousCompareAtPriceToman: number | null;
  newCompareAtPriceToman: number | null;
  previousLeadTimeDays: number | null;
  newLeadTimeDays: number | null;
  reason: string | null;
  actor: string;
  createdAt: string;
}>;

export type AdminPricingCatalog = Readonly<{
  products: readonly AdminPricingProduct[];
  platingRates: readonly AdminPricingRate[];
  history: readonly AdminPricingHistory[];
}>;

const PRODUCT_STATUSES = new Set<AdminPricingProductStatus>(['DRAFT', 'ACTIVE', 'ARCHIVED']);
const PLATING_TYPES = new Set<AdminPricingRate['type']>(['GOLD', 'RHODIUM']);

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

function actorLabel(value: unknown): string {
  const actor = record(value);
  const name = [text(actor?.firstName), text(actor?.lastName)].filter(Boolean).join(' ');
  return name || text(actor?.phone) || 'سیستم';
}

function parseProduct(value: unknown): AdminPricingProduct | null {
  const item = record(value);
  const id = text(item?.id);
  const name = text(item?.name);
  const slug = text(item?.slug);
  const status = text(item?.status) as AdminPricingProductStatus | null;
  if (
    !id ||
    !name ||
    !slug ||
    !status ||
    !PRODUCT_STATUSES.has(status) ||
    !Array.isArray(item?.suppliers)
  )
    return null;
  const suppliers = item.suppliers;
  const link = record(suppliers[0]);
  const supplier = record(link?.supplier);
  return {
    id,
    name,
    slug,
    status,
    salePriceToman: number(item?.salePriceToman),
    compareAtPriceToman: number(item?.compareAtPriceToman),
    supplierCostToman: number(link?.supplierPriceToman),
    supplierName: text(supplier?.name),
  };
}

function parseRate(value: unknown): AdminPricingRate | null {
  const item = record(value);
  const id = text(item?.id);
  const type = text(item?.type) as AdminPricingRate['type'] | null;
  const price = number(item?.pricePerGramToman);
  const leadTime = number(item?.leadTimeDays);
  const updatedAt = text(item?.updatedAt);
  if (!id || !type || !PLATING_TYPES.has(type) || price === null || leadTime === null || !updatedAt)
    return null;
  return {
    id,
    type,
    pricePerGramToman: price,
    leadTimeDays: leadTime,
    active: item?.isActive !== false,
    updatedAt,
  };
}

function parseProductHistory(value: unknown): AdminPricingHistory | null {
  const item = record(value);
  const product = record(item?.product);
  const id = text(item?.id);
  const title = text(product?.name);
  const nextPrice = number(item?.newPriceToman);
  const createdAt = text(item?.createdAt);
  if (!id || !title || nextPrice === null || !createdAt) return null;
  return {
    id,
    kind: 'PRODUCT',
    title,
    previousPriceToman: number(item?.previousPriceToman),
    newPriceToman: nextPrice,
    previousCompareAtPriceToman: number(item?.previousCompareAtPriceToman),
    newCompareAtPriceToman: number(item?.newCompareAtPriceToman),
    previousLeadTimeDays: null,
    newLeadTimeDays: null,
    reason: text(item?.reason),
    actor: actorLabel(item?.changedBy),
    createdAt,
  };
}

function parsePlatingHistory(value: unknown): AdminPricingHistory | null {
  const item = record(value);
  const rate = record(item?.platingRate);
  const id = text(item?.id);
  const type = text(rate?.type) as AdminPricingRate['type'] | null;
  const nextPrice = number(item?.newPricePerGramToman);
  const createdAt = text(item?.createdAt);
  if (!id || !type || !PLATING_TYPES.has(type) || nextPrice === null || !createdAt) return null;
  return {
    id,
    kind: 'PLATING',
    title: type === 'GOLD' ? 'نرخ آبکاری طلا' : 'نرخ آبکاری رودیوم',
    previousPriceToman: number(item?.previousPricePerGramToman),
    newPriceToman: nextPrice,
    previousCompareAtPriceToman: null,
    newCompareAtPriceToman: null,
    previousLeadTimeDays: number(item?.previousLeadTimeDays),
    newLeadTimeDays: number(item?.newLeadTimeDays),
    reason: text(item?.reason),
    actor: actorLabel(item?.changedBy),
    createdAt,
  };
}

export function parsePricingCatalog(value: unknown): AdminPricingCatalog | null {
  const root = record(value);
  if (
    !Array.isArray(root?.products) ||
    !Array.isArray(root?.platingRates) ||
    !Array.isArray(root?.productHistory) ||
    !Array.isArray(root?.platingHistory)
  )
    return null;
  const products = root.products.map(parseProduct);
  const platingRates = root.platingRates.map(parseRate);
  const productHistory = root.productHistory.map(parseProductHistory);
  const platingHistory = root.platingHistory.map(parsePlatingHistory);
  if ([...products, ...platingRates, ...productHistory, ...platingHistory].some((item) => !item))
    return null;
  return {
    products: products as AdminPricingProduct[],
    platingRates: platingRates as AdminPricingRate[],
    history: [
      ...(productHistory as AdminPricingHistory[]),
      ...(platingHistory as AdminPricingHistory[]),
    ].sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt)),
  };
}

export function productGrossMargin(product: AdminPricingProduct): number | null {
  if (product.salePriceToman === null || product.supplierCostToman === null) return null;
  return product.salePriceToman - product.supplierCostToman;
}

export function productDiscountPercent(product: AdminPricingProduct): number | null {
  if (
    product.salePriceToman === null ||
    product.compareAtPriceToman === null ||
    product.compareAtPriceToman <= product.salePriceToman
  )
    return null;
  return Math.round(
    ((product.compareAtPriceToman - product.salePriceToman) / product.compareAtPriceToman) * 100,
  );
}
