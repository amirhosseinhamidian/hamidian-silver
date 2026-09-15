export const ORDER_RETURN_STATUSES = ['REQUESTED', 'RECEIVED', 'CANCELLED'] as const;
export const ORDER_RETURN_DISPOSITIONS = ['RESTOCK', 'RETURN_TO_SUPPLIER'] as const;

export type AdminOrderReturnStatus = (typeof ORDER_RETURN_STATUSES)[number];
export type AdminOrderReturnDisposition = (typeof ORDER_RETURN_DISPOSITIONS)[number];

export type AdminOrderReturnActor = Readonly<{
  id: string;
  phone: string;
  firstName: string | null;
  lastName: string | null;
}>;

export type AdminOrderReturnItem = Readonly<{
  id: string;
  orderItemId: string;
  quantity: number;
  disposition: AdminOrderReturnDisposition | null;
  orderItem: Readonly<{
    productName: string;
    variantName: string | null;
    sku: string;
    soldQuantity: number;
    allocatedQuantity: number;
    returnedQuantity: number;
    supplierId: string | null;
    supplierName: string | null;
    unitSupplierPriceToman: number | null;
  }>;
  supplierCredit: Readonly<{
    amountToman: number;
    status: string;
  }> | null;
}>;

export type AdminOrderReturn = Readonly<{
  id: string;
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  warehouseId: string;
  status: AdminOrderReturnStatus;
  reason: string | null;
  receiveNote: string | null;
  cancelReason: string | null;
  requestedBy: AdminOrderReturnActor | null;
  receivedBy: AdminOrderReturnActor | null;
  cancelledBy: AdminOrderReturnActor | null;
  receivedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: readonly AdminOrderReturnItem[];
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

function actor(value: unknown): AdminOrderReturnActor | null | undefined {
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

function item(value: unknown): AdminOrderReturnItem | null {
  const source = record(value);
  const orderItem = record(source?.orderItem);
  const rawSupplierCredit = source?.supplierCredit;
  const supplierCredit = record(rawSupplierCredit);
  const id = text(source?.id);
  const orderItemId = text(source?.orderItemId);
  const quantity = integer(source?.quantity);
  const disposition = source?.disposition;
  const productName = text(orderItem?.productNameSnapshot);
  const sku = text(orderItem?.skuSnapshot);
  const soldQuantity = integer(orderItem?.quantity);
  const allocatedQuantity = integer(orderItem?.returnAllocatedQuantity);
  const returnedQuantity = integer(orderItem?.returnedQuantity);
  const rawUnitSupplierPrice = orderItem?.unitSupplierPriceToman;
  const unitSupplierPrice =
    rawUnitSupplierPrice === null || rawUnitSupplierPrice === undefined
      ? null
      : integer(rawUnitSupplierPrice);
  const creditAmount = supplierCredit ? integer(supplierCredit.amountToman) : null;
  const creditStatus = supplierCredit ? text(supplierCredit.status) : null;
  if (
    !id ||
    !orderItemId ||
    quantity === null ||
    (disposition !== null &&
      disposition !== undefined &&
      !includes(ORDER_RETURN_DISPOSITIONS, disposition)) ||
    !productName ||
    !sku ||
    soldQuantity === null ||
    allocatedQuantity === null ||
    returnedQuantity === null ||
    (rawUnitSupplierPrice !== null &&
      rawUnitSupplierPrice !== undefined &&
      unitSupplierPrice === null) ||
    (rawSupplierCredit !== null && rawSupplierCredit !== undefined && !supplierCredit) ||
    (supplierCredit && (creditAmount === null || !creditStatus))
  ) {
    return null;
  }
  return {
    id,
    orderItemId,
    quantity,
    disposition: includes(ORDER_RETURN_DISPOSITIONS, disposition) ? disposition : null,
    orderItem: {
      productName,
      variantName: nullableText(orderItem?.variantNameSnapshot),
      sku,
      soldQuantity,
      allocatedQuantity,
      returnedQuantity,
      supplierId: nullableText(orderItem?.supplierIdSnapshot),
      supplierName: nullableText(orderItem?.supplierNameSnapshot),
      unitSupplierPriceToman: unitSupplierPrice,
    },
    supplierCredit: supplierCredit
      ? { amountToman: creditAmount as number, status: creditStatus as string }
      : null,
  };
}

function parseReturn(value: unknown): AdminOrderReturn | null {
  const source = record(value);
  const order = record(source?.order);
  const id = text(source?.id);
  const orderId = text(source?.orderId);
  const orderNumber = text(order?.orderNumber);
  const orderStatus = text(order?.status);
  const warehouseId = text(order?.warehouseId);
  const status = source?.status;
  const requestedBy = actor(source?.requestedBy);
  const receivedBy = actor(source?.receivedBy);
  const cancelledBy = actor(source?.cancelledBy);
  const createdAt = date(source?.createdAt);
  const updatedAt = date(source?.updatedAt);
  const rawItems = source?.items;
  if (
    !id ||
    !orderId ||
    !orderNumber ||
    !orderStatus ||
    !warehouseId ||
    !includes(ORDER_RETURN_STATUSES, status) ||
    requestedBy === undefined ||
    receivedBy === undefined ||
    cancelledBy === undefined ||
    !createdAt ||
    !updatedAt ||
    !Array.isArray(rawItems)
  ) {
    return null;
  }
  const items = rawItems.map(item);
  if (items.some((candidate) => candidate === null)) return null;
  return {
    id,
    orderId,
    orderNumber,
    orderStatus,
    warehouseId,
    status,
    reason: nullableText(source?.reason),
    receiveNote: nullableText(source?.receiveNote),
    cancelReason: nullableText(source?.cancelReason),
    requestedBy,
    receivedBy,
    cancelledBy,
    receivedAt: nullableDate(source?.receivedAt),
    cancelledAt: nullableDate(source?.cancelledAt),
    createdAt,
    updatedAt,
    items: items as AdminOrderReturnItem[],
  };
}

export function parseOrderReturns(value: unknown): readonly AdminOrderReturn[] | null {
  if (!Array.isArray(value)) return null;
  const returns = value.map(parseReturn);
  return returns.some((item) => item === null) ? null : (returns as AdminOrderReturn[]);
}

export function parseOrderReturn(value: unknown): AdminOrderReturn | null {
  return parseOrderReturns([value])?.[0] ?? null;
}
