export const SUPPLIER_PAYABLE_STATUSES = ['OPEN', 'PAID'] as const;

export type AdminSupplierPayableStatus = (typeof SUPPLIER_PAYABLE_STATUSES)[number];

export type AdminSupplierPayableActor = Readonly<{
  id: string;
  phone: string;
  firstName: string | null;
  lastName: string | null;
}>;

export type AdminSupplierPayable = Readonly<{
  id: string;
  orderId: string;
  orderItemId: string;
  supplierId: string;
  supplierName: string;
  quantity: number;
  unitSupplierPriceToman: number;
  amountToman: number;
  status: AdminSupplierPayableStatus;
  settlementId: string | null;
  paidAt: string | null;
  paymentReference: string | null;
  settlementNote: string | null;
  createdAt: string;
  updatedAt: string;
  order: Readonly<{
    id: string;
    orderNumber: string;
    status: string;
    paidAt: string | null;
  }>;
  orderItem: Readonly<{
    id: string;
    productName: string;
    variantName: string | null;
    sku: string;
  }>;
  paidBy: AdminSupplierPayableActor | null;
}>;

export type AdminSupplierPayableSummary = Readonly<{
  supplierId: string;
  supplierName: string;
  openAmountToman: number;
  openCount: number;
  paidAmountToman: number;
  paidCount: number;
  totalAmountToman: number;
  totalCount: number;
}>;

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function nullableText(value: unknown): string | null {
  return value === null || value === undefined ? null : text(value);
}

function integer(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
}

function date(value: unknown): string | null {
  const candidate = text(value);
  return candidate && !Number.isNaN(Date.parse(candidate)) ? candidate : null;
}

function nullableDate(value: unknown): string | null {
  return value === null || value === undefined ? null : date(value);
}

function includes<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && values.some((candidate) => candidate === value);
}

function actor(value: unknown): AdminSupplierPayableActor | null | undefined {
  if (value === null || value === undefined) return null;
  const source = record(value);
  const id = text(source?.id);
  const phone = text(source?.phone);
  if (!id || !phone) return undefined;
  return {
    id,
    phone,
    firstName: nullableText(source?.firstName),
    lastName: nullableText(source?.lastName),
  };
}

function payable(value: unknown): AdminSupplierPayable | null {
  const source = record(value);
  const order = record(source?.order);
  const orderItem = record(source?.orderItem);
  const id = text(source?.id);
  const orderId = text(source?.orderId);
  const orderItemId = text(source?.orderItemId);
  const supplierId = text(source?.supplierIdSnapshot);
  const supplierName = text(source?.supplierNameSnapshot);
  const quantity = integer(source?.quantity);
  const unitSupplierPriceToman = integer(source?.unitSupplierPriceToman);
  const amountToman = integer(source?.amountToman);
  const status = source?.status;
  const createdAt = date(source?.createdAt);
  const updatedAt = date(source?.updatedAt);
  const orderNumber = text(order?.orderNumber);
  const orderStatus = text(order?.status);
  const productName = text(orderItem?.productNameSnapshot);
  const sku = text(orderItem?.skuSnapshot);
  const paidBy = actor(source?.paidBy);
  const paidAt = nullableDate(source?.paidAt);
  const orderPaidAt = nullableDate(order?.paidAt);
  if (
    !id ||
    !orderId ||
    !orderItemId ||
    !supplierId ||
    !supplierName ||
    quantity === null ||
    unitSupplierPriceToman === null ||
    amountToman === null ||
    !includes(SUPPLIER_PAYABLE_STATUSES, status) ||
    !createdAt ||
    !updatedAt ||
    !orderNumber ||
    !orderStatus ||
    !productName ||
    !sku ||
    paidBy === undefined ||
    (source?.paidAt !== null && source?.paidAt !== undefined && paidAt === null) ||
    (order?.paidAt !== null && order?.paidAt !== undefined && orderPaidAt === null)
  ) {
    return null;
  }
  return {
    id,
    orderId,
    orderItemId,
    supplierId,
    supplierName,
    quantity,
    unitSupplierPriceToman,
    amountToman,
    status,
    settlementId: nullableText(source?.settlementId),
    paidAt,
    paymentReference: nullableText(source?.paymentReference),
    settlementNote: nullableText(source?.settlementNote),
    createdAt,
    updatedAt,
    order: {
      id: text(order?.id) ?? orderId,
      orderNumber,
      status: orderStatus,
      paidAt: orderPaidAt,
    },
    orderItem: {
      id: text(orderItem?.id) ?? orderItemId,
      productName,
      variantName: nullableText(orderItem?.variantNameSnapshot),
      sku,
    },
    paidBy,
  };
}

function summary(value: unknown): AdminSupplierPayableSummary | null {
  const source = record(value);
  const supplierId = text(source?.supplierIdSnapshot);
  const supplierName = text(source?.supplierNameSnapshot);
  const openAmountToman = integer(source?.openAmountToman);
  const openCount = integer(source?.openCount);
  const paidAmountToman = integer(source?.paidAmountToman);
  const paidCount = integer(source?.paidCount);
  const totalAmountToman = integer(source?.totalAmountToman);
  const totalCount = integer(source?.totalCount);
  if (
    !supplierId ||
    !supplierName ||
    openAmountToman === null ||
    openCount === null ||
    paidAmountToman === null ||
    paidCount === null ||
    totalAmountToman === null ||
    totalCount === null ||
    totalAmountToman !== openAmountToman + paidAmountToman ||
    totalCount !== openCount + paidCount
  ) {
    return null;
  }
  return {
    supplierId,
    supplierName,
    openAmountToman,
    openCount,
    paidAmountToman,
    paidCount,
    totalAmountToman,
    totalCount,
  };
}

export function parseSupplierPayables(value: unknown): readonly AdminSupplierPayable[] | null {
  if (!Array.isArray(value)) return null;
  const payables = value.map(payable);
  return payables.some((item) => item === null) ? null : (payables as AdminSupplierPayable[]);
}

export function parseSupplierPayableSummary(
  value: unknown,
): readonly AdminSupplierPayableSummary[] | null {
  if (!Array.isArray(value)) return null;
  const rows = value.map(summary);
  return rows.some((item) => item === null) ? null : (rows as AdminSupplierPayableSummary[]);
}

const periodFormatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  year: 'numeric',
  month: 'long',
  timeZone: 'Asia/Tehran',
});

export function supplierPayablePeriod(value: string): string {
  const dateValue = new Date(value);
  return Number.isNaN(dateValue.getTime()) ? 'دوره نامشخص' : periodFormatter.format(dateValue);
}
