import { toAsciiDigits } from '@/lib/presentation/formatters';

export type ProductStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
export type ProductSizeMode = 'NONE' | 'FREE_SIZE' | 'SIZED';

export type CatalogLookup = Readonly<{
  id: string;
  name: string;
}>;

export type AdminCategoryImage = Readonly<{
  id: string;
  url: string;
  altText: string | null;
  mimeType: string;
}>;

export type AdminCategory = Readonly<{
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  parent: CatalogLookup | null;
  parentId: string | null;
  image: AdminCategoryImage | null;
  childCount: number;
  productCount: number;
}>;

export type AdminBrand = Readonly<{
  id: string;
  name: string;
  slug: string;
  description: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  image: AdminCategoryImage | null;
  productCount: number;
}>;

export type AdminCountry = Readonly<{
  id: string;
  name: string;
  slug: string;
  isoCode: string;
  description: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  image: AdminCategoryImage | null;
  productCount: number;
}>;

export type CatalogSize = Readonly<{
  id: string;
  code: string;
  label: string;
  sortOrder: number;
  active: boolean;
}>;

export type VariantSize = Readonly<{ id: string; label: string }>;

export type AdminProductVariant = Readonly<{
  id: string;
  sku: string;
  name: string | null;
  weightGrams: number | null;
  active: boolean;
  size: VariantSize | null;
}>;

export type AdminProductMedia = Readonly<{
  id: string;
  url: string | null;
  altText: string | null;
  isPrimary: boolean;
  sortOrder: number;
  mimeType: string;
  originalName: string | null;
  sizeBytes: number;
  width: number | null;
  height: number | null;
}>;

export type AdminProduct = Readonly<{
  id: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  description: string | null;
  status: ProductStatus;
  sizeMode: ProductSizeMode;
  salePriceToman: number | null;
  compareAtPriceToman: number | null;
  createdAt: string;
  updatedAt: string;
  brand: CatalogLookup | null;
  country: CatalogLookup | null;
  categories: readonly CatalogLookup[];
  variants: readonly AdminProductVariant[];
  media: readonly AdminProductMedia[];
  mediaCount: number;
}>;

export type CatalogFilters = Readonly<{
  q: string;
  status: ProductStatus | '';
  brandId: string;
  categoryId: string;
  page: number;
  limit: number;
}>;

export type ProductListResult = Readonly<{
  items: readonly AdminProduct[];
  total: number;
  page: number;
  limit: number;
}>;

const STATUSES = new Set<ProductStatus>(['DRAFT', 'ACTIVE', 'ARCHIVED']);
const SIZE_MODES = new Set<ProductSizeMode>(['NONE', 'FREE_SIZE', 'SIZED']);

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

function lookup(value: unknown, labelKey: 'name' | 'label' = 'name'): CatalogLookup | null {
  const item = record(value);
  const id = text(item?.id);
  const name = text(item?.[labelKey]);
  return id && name ? { id, name } : null;
}

function parseVariant(value: unknown): AdminProductVariant | null {
  const item = record(value);
  const id = text(item?.id);
  const sku = text(item?.sku);
  if (!id || !sku) return null;

  const parsedSize = lookup(item?.size, 'label');
  return {
    id,
    sku,
    name: text(item?.name),
    weightGrams: number(item?.weightGrams),
    active: item?.isActive !== false,
    size: parsedSize ? { id: parsedSize.id, label: parsedSize.name } : null,
  };
}

function parseProductMedia(value: unknown): AdminProductMedia | null {
  const item = record(value);
  const media = record(item?.media);
  const id = text(item?.mediaId) ?? text(item?.id) ?? text(media?.id);
  const mimeType = text(item?.mimeType) ?? text(media?.mimeType);
  const sizeBytes = number(item?.sizeBytes) ?? number(media?.sizeBytes);
  if (!id || !mimeType || sizeBytes === null) return null;

  return {
    id,
    url: text(item?.url),
    altText: text(item?.altText) ?? text(media?.altText),
    isPrimary: item?.isPrimary === true,
    sortOrder: number(item?.sortOrder) ?? 0,
    mimeType,
    originalName: text(item?.originalName) ?? text(media?.originalName),
    sizeBytes,
    width: number(item?.width) ?? number(media?.width),
    height: number(item?.height) ?? number(media?.height),
  };
}

export function parseAdminProduct(value: unknown): AdminProduct | null {
  const item = record(value);
  const id = text(item?.id);
  const name = text(item?.name);
  const slug = text(item?.slug);
  const status = text(item?.status) as ProductStatus | null;
  const sizeMode = text(item?.sizeMode) as ProductSizeMode | null;
  const createdAt = text(item?.createdAt);
  const updatedAt = text(item?.updatedAt);
  if (
    !id ||
    !name ||
    !slug ||
    !status ||
    !STATUSES.has(status) ||
    !sizeMode ||
    !SIZE_MODES.has(sizeMode) ||
    !createdAt ||
    !updatedAt
  ) {
    return null;
  }

  const categoryRelations = Array.isArray(item?.categories) ? item.categories : [];
  const categories = categoryRelations
    .map((relation) => lookup(record(relation)?.category ?? relation))
    .filter((category): category is CatalogLookup => category !== null);
  const variants = (Array.isArray(item?.variants) ? item.variants : [])
    .map(parseVariant)
    .filter((variant): variant is AdminProductVariant => variant !== null);
  const rawMedia = Array.isArray(item?.media) ? item.media : [];
  const media = rawMedia
    .map(parseProductMedia)
    .filter((mediaItem): mediaItem is AdminProductMedia => mediaItem !== null)
    .sort((left, right) => left.sortOrder - right.sortOrder);
  if (media.length !== rawMedia.length) return null;

  return {
    id,
    name,
    slug,
    shortDescription: text(item?.shortDescription),
    description: text(item?.description),
    status,
    sizeMode,
    salePriceToman: number(item?.salePriceToman),
    compareAtPriceToman: number(item?.compareAtPriceToman),
    createdAt,
    updatedAt,
    brand: lookup(item?.brand),
    country: lookup(item?.country),
    categories,
    variants,
    media,
    mediaCount: media.length,
  };
}

export function parseProductList(value: unknown): ProductListResult | null {
  const payload = record(value);
  const rawItems = Array.isArray(value)
    ? value
    : Array.isArray(payload?.items)
      ? payload.items
      : null;
  if (!rawItems) return null;

  const items = rawItems
    .map(parseAdminProduct)
    .filter((product): product is AdminProduct => product !== null);
  if (items.length !== rawItems.length) return null;

  return {
    items,
    total: number(payload?.total) ?? items.length,
    page: number(payload?.page) ?? 1,
    limit: number(payload?.limit) ?? Math.max(items.length, 1),
  };
}

export function parseCatalogLookups(value: unknown): readonly CatalogLookup[] | null {
  if (!Array.isArray(value)) return null;
  const items = value
    .map((item) => lookup(item))
    .filter((item): item is CatalogLookup => item !== null);
  return items.length === value.length ? items : null;
}

function parseCategory(value: unknown): AdminCategory | null {
  const item = record(value);
  const id = text(item?.id);
  const name = text(item?.name);
  const slug = text(item?.slug);
  const createdAt = text(item?.createdAt);
  const updatedAt = text(item?.updatedAt);
  if (!id || !name || !slug || !createdAt || !updatedAt) return null;

  const rawImage = record(item?.image);
  const imageId = text(rawImage?.id);
  const imageUrl = text(rawImage?.url);
  const imageMimeType = text(rawImage?.mimeType);
  const image =
    imageId && imageUrl && imageMimeType
      ? {
          id: imageId,
          url: imageUrl,
          altText: text(rawImage?.altText),
          mimeType: imageMimeType,
        }
      : null;

  return {
    id,
    name,
    slug,
    description: text(item?.description),
    sortOrder: number(item?.sortOrder) ?? 0,
    active: item?.isActive !== false,
    createdAt,
    updatedAt,
    parent: lookup(item?.parent),
    parentId: text(item?.parentId),
    image,
    childCount: number(item?.childCount) ?? 0,
    productCount: number(item?.productCount) ?? 0,
  };
}

export function parseAdminCategories(value: unknown): readonly AdminCategory[] | null {
  if (!Array.isArray(value)) return null;
  const categories = value
    .map(parseCategory)
    .filter((category): category is AdminCategory => category !== null);
  return categories.length === value.length ? categories : null;
}

function parseReferenceImage(value: unknown): AdminCategoryImage | null {
  const item = record(value);
  const id = text(item?.id);
  const url = text(item?.url);
  const mimeType = text(item?.mimeType);
  return id && url && mimeType ? { id, url, mimeType, altText: text(item?.altText) } : null;
}

function parseAdminBrand(value: unknown): AdminBrand | null {
  const item = record(value);
  const id = text(item?.id);
  const name = text(item?.name);
  const slug = text(item?.slug);
  const createdAt = text(item?.createdAt);
  const updatedAt = text(item?.updatedAt);
  if (!id || !name || !slug || !createdAt || !updatedAt) return null;
  return {
    id,
    name,
    slug,
    description: text(item?.description),
    active: item?.isActive !== false,
    createdAt,
    updatedAt,
    image: parseReferenceImage(item?.image),
    productCount: number(item?.productCount) ?? 0,
  };
}

export function parseAdminBrands(value: unknown): readonly AdminBrand[] | null {
  if (!Array.isArray(value)) return null;
  const items = value.map(parseAdminBrand).filter((item): item is AdminBrand => item !== null);
  return items.length === value.length ? items : null;
}

function parseAdminCountry(value: unknown): AdminCountry | null {
  const item = record(value);
  const id = text(item?.id);
  const name = text(item?.name);
  const slug = text(item?.slug);
  const isoCode = text(item?.isoCode);
  const createdAt = text(item?.createdAt);
  const updatedAt = text(item?.updatedAt);
  if (!id || !name || !slug || !isoCode || !createdAt || !updatedAt) return null;
  return {
    id,
    name,
    slug,
    isoCode,
    description: text(item?.description),
    active: item?.isActive !== false,
    createdAt,
    updatedAt,
    image: parseReferenceImage(item?.image),
    productCount: number(item?.productCount) ?? 0,
  };
}

export function parseAdminCountries(value: unknown): readonly AdminCountry[] | null {
  if (!Array.isArray(value)) return null;
  const items = value.map(parseAdminCountry).filter((item): item is AdminCountry => item !== null);
  return items.length === value.length ? items : null;
}

export function parseCatalogSizes(value: unknown): readonly CatalogSize[] | null {
  if (!Array.isArray(value)) return null;
  const items = value
    .map((value): CatalogSize | null => {
      const item = record(value);
      const id = text(item?.id);
      const code = text(item?.code);
      const label = text(item?.label);
      if (!id || !code || !label) return null;
      return {
        id,
        code,
        label,
        sortOrder: number(item?.sortOrder) ?? 0,
        active: item?.isActive !== false,
      };
    })
    .filter((item): item is CatalogSize => item !== null);
  return items.length === value.length ? items : null;
}

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

export function parseCatalogFilters(
  params: Record<string, string | string[] | undefined>,
): CatalogFilters {
  const statusValue = first(params.status) as ProductStatus;
  const parsedPage = Number(toAsciiDigits(first(params.page)));
  const parsedLimit = Number(toAsciiDigits(first(params.limit)));

  return {
    q: first(params.q).trim().slice(0, 100),
    status: STATUSES.has(statusValue) ? statusValue : '',
    brandId: first(params.brandId) === 'all' ? '' : first(params.brandId),
    categoryId: first(params.categoryId) === 'all' ? '' : first(params.categoryId),
    page: Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1,
    limit: [10, 20, 50].includes(parsedLimit) ? parsedLimit : 20,
  };
}

export function productStatusLabel(status: ProductStatus): string {
  return status === 'ACTIVE' ? 'منتشرشده' : status === 'DRAFT' ? 'پیش‌نویس' : 'آرشیوشده';
}

export function productSizeModeLabel(mode: ProductSizeMode): string {
  return mode === 'SIZED' ? 'سایزبندی‌شده' : mode === 'FREE_SIZE' ? 'فری‌سایز' : 'بدون سایز';
}
