export type AdminPlatingType = 'GOLD' | 'RHODIUM';

export type AdminPlatingRate = Readonly<{
  id: string;
  type: AdminPlatingType;
  pricePerGramToman: number;
  leadTimeDays: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}>;

export type AdminPlatingOption = Readonly<{
  type: AdminPlatingType;
  active: boolean;
  rateActive: boolean;
  pricePerGramToman: number;
  leadTimeDays: number;
}>;

export type AdminPlatingVariant = Readonly<{
  id: string;
  productId: string;
  productName: string;
  productSlug: string;
  productStatus: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  sku: string;
  name: string | null;
  sizeLabel: string | null;
  weightGrams: number | null;
  active: boolean;
  eligible: boolean;
  options: readonly AdminPlatingOption[];
}>;

const PLATING_TYPES = new Set<AdminPlatingType>(['GOLD', 'RHODIUM']);
const PRODUCT_STATUSES = new Set<AdminPlatingVariant['productStatus']>([
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

function number(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseRate(value: unknown): AdminPlatingRate | null {
  const item = record(value);
  const id = text(item?.id);
  const type = text(item?.type) as AdminPlatingType | null;
  const price = number(item?.pricePerGramToman);
  const leadTime = number(item?.leadTimeDays);
  const createdAt = text(item?.createdAt);
  const updatedAt = text(item?.updatedAt);
  if (
    !id ||
    !type ||
    !PLATING_TYPES.has(type) ||
    price === null ||
    leadTime === null ||
    !createdAt ||
    !updatedAt
  ) {
    return null;
  }
  return {
    id,
    type,
    pricePerGramToman: price,
    leadTimeDays: leadTime,
    active: item?.isActive !== false,
    createdAt,
    updatedAt,
  };
}

export function parsePlatingRates(value: unknown): readonly AdminPlatingRate[] | null {
  if (!Array.isArray(value)) return null;
  const rates = value.map(parseRate).filter((rate): rate is AdminPlatingRate => rate !== null);
  return rates.length === value.length ? rates : null;
}

function parseOption(value: unknown): AdminPlatingOption | null {
  const item = record(value);
  const rate = record(item?.platingRate);
  const type = text(rate?.type) as AdminPlatingType | null;
  const price = number(rate?.pricePerGramToman);
  const leadTime = number(rate?.leadTimeDays);
  if (!type || !PLATING_TYPES.has(type) || price === null || leadTime === null) return null;
  return {
    type,
    active: item?.isActive !== false,
    rateActive: rate?.isActive !== false,
    pricePerGramToman: price,
    leadTimeDays: leadTime,
  };
}

function parseVariant(value: unknown): AdminPlatingVariant | null {
  const item = record(value);
  const product = record(item?.product);
  const size = record(item?.size);
  const id = text(item?.id);
  const sku = text(item?.sku);
  const productId = text(product?.id);
  const productName = text(product?.name);
  const productSlug = text(product?.slug);
  const productStatus = text(product?.status) as AdminPlatingVariant['productStatus'] | null;
  if (
    !id ||
    !sku ||
    !productId ||
    !productName ||
    !productSlug ||
    !productStatus ||
    !PRODUCT_STATUSES.has(productStatus)
  ) {
    return null;
  }
  const rawOptions = Array.isArray(item?.platingOptions) ? item.platingOptions : [];
  const options = rawOptions
    .map(parseOption)
    .filter((option): option is AdminPlatingOption => option !== null);
  if (options.length !== rawOptions.length) return null;
  return {
    id,
    sku,
    name: text(item?.name),
    weightGrams: number(item?.weightGrams),
    active: item?.isActive !== false,
    eligible: item?.platingEligible === true,
    productId,
    productName,
    productSlug,
    productStatus,
    sizeLabel: text(size?.label),
    options,
  };
}

export function parsePlatingVariants(value: unknown): readonly AdminPlatingVariant[] | null {
  if (!Array.isArray(value)) return null;
  const variants = value
    .map(parseVariant)
    .filter((variant): variant is AdminPlatingVariant => variant !== null);
  return variants.length === value.length ? variants : null;
}

export function platingTypeLabel(type: AdminPlatingType): string {
  return type === 'GOLD' ? 'آبکاری طلا' : 'آبکاری رودیوم';
}
