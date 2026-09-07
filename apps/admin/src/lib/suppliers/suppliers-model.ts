export type AdminSupplier = Readonly<{
  id: string;
  code: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  active: boolean;
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

function parseSupplier(value: unknown): AdminSupplier | null {
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
    contactName: text(item?.contactName),
    phone: text(item?.phone),
    active: item?.isActive !== false,
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
