export type AdminWarehouse = Readonly<{
  id: string;
  code: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}>;

export type AdminInventoryItem = Readonly<{
  inventoryId: string | null;
  warehouseId: string;
  productId: string;
  productName: string;
  productSlug: string;
  productStatus: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  variantId: string;
  sku: string;
  variantName: string | null;
  sizeLabel: string | null;
  variantActive: boolean;
  onHand: number;
  reserved: number;
  available: number;
  lowStockThreshold: number;
  isLowStock: boolean;
  updatedAt: string | null;
}>;

const PRODUCT_STATUSES = new Set<AdminInventoryItem['productStatus']>([
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

function integer(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null;
}

function parseWarehouse(value: unknown): AdminWarehouse | null {
  const item = record(value);
  const id = text(item?.id);
  const code = text(item?.code);
  const name = text(item?.name);
  const createdAt = text(item?.createdAt);
  const updatedAt = text(item?.updatedAt);
  if (!id || !code || !name || !createdAt || !updatedAt) return null;
  return {
    id,
    code,
    name,
    isDefault: item?.isDefault === true,
    isActive: item?.isActive !== false,
    createdAt,
    updatedAt,
  };
}

export function parseWarehouses(value: unknown): readonly AdminWarehouse[] | null {
  if (!Array.isArray(value)) return null;
  const items = value.map(parseWarehouse).filter((item): item is AdminWarehouse => item !== null);
  return items.length === value.length ? items : null;
}

function parseInventoryItem(value: unknown): AdminInventoryItem | null {
  const item = record(value);
  const warehouse = record(item?.warehouse);
  const product = record(item?.product);
  const variant = record(item?.variant);
  const size = record(variant?.size);
  const warehouseId = text(warehouse?.id);
  const productId = text(product?.id);
  const productName = text(product?.name);
  const productSlug = text(product?.slug);
  const productStatus = text(product?.status) as AdminInventoryItem['productStatus'] | null;
  const variantId = text(variant?.id);
  const sku = text(variant?.sku);
  const onHand = integer(item?.onHand);
  const reserved = integer(item?.reserved);
  const available = integer(item?.available);
  const threshold = integer(item?.lowStockThreshold);
  if (
    !warehouseId ||
    !productId ||
    !productName ||
    !productSlug ||
    !productStatus ||
    !PRODUCT_STATUSES.has(productStatus) ||
    !variantId ||
    !sku ||
    onHand === null ||
    reserved === null ||
    available === null ||
    threshold === null
  ) {
    return null;
  }
  return {
    inventoryId: text(item?.inventoryId),
    warehouseId,
    productId,
    productName,
    productSlug,
    productStatus,
    variantId,
    sku,
    variantName: text(variant?.name),
    sizeLabel: text(size?.label),
    variantActive: variant?.isActive !== false,
    onHand,
    reserved,
    available,
    lowStockThreshold: threshold,
    isLowStock: item?.isLowStock === true,
    updatedAt: text(item?.updatedAt),
  };
}

export function parseInventoryCatalog(value: unknown): readonly AdminInventoryItem[] | null {
  if (!Array.isArray(value)) return null;
  const items = value
    .map(parseInventoryItem)
    .filter((item): item is AdminInventoryItem => item !== null);
  return items.length === value.length ? items : null;
}
