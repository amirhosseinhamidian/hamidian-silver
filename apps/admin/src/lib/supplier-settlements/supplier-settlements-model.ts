export const SUPPLIER_SETTLEMENT_STATUSES = ['DRAFT', 'PAID', 'CANCELLED'] as const;
export const SETTLEMENT_CREDIT_APPLICATION_STATUSES = ['ACTIVE', 'REMOVED'] as const;

export type AdminSupplierSettlementStatus = (typeof SUPPLIER_SETTLEMENT_STATUSES)[number];
export type AdminSettlementCreditApplicationStatus =
  (typeof SETTLEMENT_CREDIT_APPLICATION_STATUSES)[number];

export type AdminSupplierSettlementActor = Readonly<{
  id: string;
  phone: string;
  firstName: string | null;
  lastName: string | null;
}>;

export type AdminSupplierSettlementItem = Readonly<{
  id: string;
  payableId: string;
  amountToman: number;
  createdAt: string;
  payable: Readonly<{
    id: string;
    orderId: string;
    status: string;
    supplierId: string;
    supplierName: string;
    quantity: number;
    unitSupplierPriceToman: number;
    amountToman: number;
    orderNumber: string;
    productName: string;
    variantName: string | null;
    sku: string;
  }>;
}>;

export type AdminSettlementCreditApplication = Readonly<{
  id: string;
  supplierCreditId: string;
  amountToman: number;
  status: AdminSettlementCreditApplicationStatus;
  removalReason: string | null;
  removedAt: string | null;
  createdAt: string;
  appliedBy: AdminSupplierSettlementActor | null;
  removedBy: AdminSupplierSettlementActor | null;
  supplierCredit: Readonly<{
    id: string;
    supplierId: string;
    supplierName: string;
    orderId: string;
    returnItemId: string;
    amountToman: number;
    appliedAmountToman: number;
    status: string;
  }>;
}>;

export type AdminSupplierSettlement = Readonly<{
  id: string;
  supplierId: string;
  supplierName: string;
  status: AdminSupplierSettlementStatus;
  totalAmountToman: number;
  creditAppliedToman: number;
  paidAmountToman: number | null;
  payableCount: number;
  note: string | null;
  paymentReference: string | null;
  paidAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: AdminSupplierSettlementActor | null;
  paidBy: AdminSupplierSettlementActor | null;
  cancelledBy: AdminSupplierSettlementActor | null;
  items: readonly AdminSupplierSettlementItem[];
  creditApplications: readonly AdminSettlementCreditApplication[];
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

function actor(value: unknown): AdminSupplierSettlementActor | null | undefined {
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

function settlementItem(value: unknown): AdminSupplierSettlementItem | null {
  const source = record(value);
  const payable = record(source?.payable);
  const order = record(payable?.order);
  const orderItem = record(payable?.orderItem);
  const id = text(source?.id);
  const payableId = text(source?.payableId);
  const amountToman = integer(source?.amountToman);
  const createdAt = date(source?.createdAt);
  const orderId = text(payable?.orderId);
  const status = text(payable?.status);
  const supplierId = text(payable?.supplierIdSnapshot);
  const supplierName = text(payable?.supplierNameSnapshot);
  const quantity = integer(payable?.quantity);
  const unitSupplierPriceToman = integer(payable?.unitSupplierPriceToman);
  const payableAmountToman = integer(payable?.amountToman);
  const orderNumber = text(order?.orderNumber);
  const productName = text(orderItem?.productNameSnapshot);
  const sku = text(orderItem?.skuSnapshot);
  if (
    !id ||
    !payableId ||
    amountToman === null ||
    !createdAt ||
    !orderId ||
    !status ||
    !supplierId ||
    !supplierName ||
    quantity === null ||
    unitSupplierPriceToman === null ||
    payableAmountToman === null ||
    !orderNumber ||
    !productName ||
    !sku
  ) {
    return null;
  }
  return {
    id,
    payableId,
    amountToman,
    createdAt,
    payable: {
      id: text(payable?.id) ?? payableId,
      orderId,
      status,
      supplierId,
      supplierName,
      quantity,
      unitSupplierPriceToman,
      amountToman: payableAmountToman,
      orderNumber,
      productName,
      variantName: nullableText(orderItem?.variantNameSnapshot),
      sku,
    },
  };
}

function creditApplication(value: unknown): AdminSettlementCreditApplication | null {
  const source = record(value);
  const credit = record(source?.supplierCredit);
  const id = text(source?.id);
  const supplierCreditId = text(source?.supplierCreditId);
  const amountToman = integer(source?.amountToman);
  const status = source?.status;
  const createdAt = date(source?.createdAt);
  const removedAt = nullableDate(source?.removedAt);
  const appliedBy = actor(source?.appliedBy);
  const removedBy = actor(source?.removedBy);
  const creditId = text(credit?.id);
  const supplierId = text(credit?.supplierIdSnapshot);
  const supplierName = text(credit?.supplierNameSnapshot);
  const orderId = text(credit?.orderId);
  const returnItemId = text(credit?.returnItemId);
  const creditAmount = integer(credit?.amountToman);
  const appliedAmount = integer(credit?.appliedAmountToman);
  const creditStatus = text(credit?.status);
  if (
    !id ||
    !supplierCreditId ||
    amountToman === null ||
    !includes(SETTLEMENT_CREDIT_APPLICATION_STATUSES, status) ||
    !createdAt ||
    (source?.removedAt !== null && source?.removedAt !== undefined && removedAt === null) ||
    appliedBy === undefined ||
    removedBy === undefined ||
    !creditId ||
    !supplierId ||
    !supplierName ||
    !orderId ||
    !returnItemId ||
    creditAmount === null ||
    appliedAmount === null ||
    !creditStatus
  ) {
    return null;
  }
  return {
    id,
    supplierCreditId,
    amountToman,
    status,
    removalReason: nullableText(source?.removalReason),
    removedAt,
    createdAt,
    appliedBy,
    removedBy,
    supplierCredit: {
      id: creditId,
      supplierId,
      supplierName,
      orderId,
      returnItemId,
      amountToman: creditAmount,
      appliedAmountToman: appliedAmount,
      status: creditStatus,
    },
  };
}

function settlement(value: unknown): AdminSupplierSettlement | null {
  const source = record(value);
  const id = text(source?.id);
  const supplierId = text(source?.supplierIdSnapshot);
  const supplierName = text(source?.supplierNameSnapshot);
  const status = source?.status;
  const totalAmountToman = integer(source?.totalAmountToman);
  const creditAppliedToman = integer(source?.creditAppliedToman);
  const rawPaidAmount = source?.paidAmountToman;
  const paidAmountToman =
    rawPaidAmount === null || rawPaidAmount === undefined ? null : integer(rawPaidAmount);
  const payableCount = integer(source?.payableCount);
  const createdAt = date(source?.createdAt);
  const updatedAt = date(source?.updatedAt);
  const paidAt = nullableDate(source?.paidAt);
  const cancelledAt = nullableDate(source?.cancelledAt);
  const createdBy = actor(source?.createdBy);
  const paidBy = actor(source?.paidBy);
  const cancelledBy = actor(source?.cancelledBy);
  const rawItems = source?.items;
  const rawApplications = source?.creditApplications;
  if (
    !id ||
    !supplierId ||
    !supplierName ||
    !includes(SUPPLIER_SETTLEMENT_STATUSES, status) ||
    totalAmountToman === null ||
    creditAppliedToman === null ||
    creditAppliedToman > totalAmountToman ||
    (rawPaidAmount !== null && rawPaidAmount !== undefined && paidAmountToman === null) ||
    payableCount === null ||
    !createdAt ||
    !updatedAt ||
    (source?.paidAt !== null && source?.paidAt !== undefined && paidAt === null) ||
    (source?.cancelledAt !== null && source?.cancelledAt !== undefined && cancelledAt === null) ||
    createdBy === undefined ||
    paidBy === undefined ||
    cancelledBy === undefined ||
    (rawItems !== null && rawItems !== undefined && !Array.isArray(rawItems)) ||
    (rawApplications !== null && rawApplications !== undefined && !Array.isArray(rawApplications))
  ) {
    return null;
  }
  const items = Array.isArray(rawItems) ? rawItems.map(settlementItem) : [];
  const creditApplications = Array.isArray(rawApplications)
    ? rawApplications.map(creditApplication)
    : [];
  if (
    items.some((item) => item === null) ||
    creditApplications.some((application) => application === null)
  ) {
    return null;
  }
  return {
    id,
    supplierId,
    supplierName,
    status,
    totalAmountToman,
    creditAppliedToman,
    paidAmountToman,
    payableCount,
    note: nullableText(source?.note),
    paymentReference: nullableText(source?.paymentReference),
    paidAt,
    cancelledAt,
    createdAt,
    updatedAt,
    createdBy,
    paidBy,
    cancelledBy,
    items: items as AdminSupplierSettlementItem[],
    creditApplications: creditApplications as AdminSettlementCreditApplication[],
  };
}

export function parseSupplierSettlements(
  value: unknown,
): readonly AdminSupplierSettlement[] | null {
  if (!Array.isArray(value)) return null;
  const settlements = value.map(settlement);
  return settlements.some((item) => item === null)
    ? null
    : (settlements as AdminSupplierSettlement[]);
}

export function parseSupplierSettlement(value: unknown): AdminSupplierSettlement | null {
  return parseSupplierSettlements([value])?.[0] ?? null;
}

export function supplierSettlementNetAmount(settlement: AdminSupplierSettlement): number {
  return Math.max(0, settlement.totalAmountToman - settlement.creditAppliedToman);
}
