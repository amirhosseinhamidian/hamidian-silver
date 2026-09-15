export const SUPPLIER_CREDIT_STATUSES = [
  'AVAILABLE',
  'PARTIALLY_APPLIED',
  'APPLIED',
  'VOIDED',
] as const;

export const SUPPLIER_CREDIT_APPLICATION_STATUSES = ['ACTIVE', 'REMOVED'] as const;

export type AdminSupplierCreditStatus = (typeof SUPPLIER_CREDIT_STATUSES)[number];
export type AdminSupplierCreditApplicationStatus =
  (typeof SUPPLIER_CREDIT_APPLICATION_STATUSES)[number];

export type AdminSupplierCreditActor = Readonly<{
  id: string;
  phone: string;
  firstName: string | null;
  lastName: string | null;
}>;

export type AdminSupplierCreditApplication = Readonly<{
  id: string;
  settlementId: string;
  amountToman: number;
  status: AdminSupplierCreditApplicationStatus;
  removalReason: string | null;
  removedAt: string | null;
  createdAt: string;
  appliedBy: AdminSupplierCreditActor | null;
  removedBy: AdminSupplierCreditActor | null;
  settlement: Readonly<{
    id: string;
    status: string;
    totalAmountToman: number;
    creditAppliedToman: number;
    paidAmountToman: number | null;
    paidAt: string | null;
  }> | null;
}>;

export type AdminSupplierCredit = Readonly<{
  id: string;
  orderId: string;
  orderItemId: string;
  returnItemId: string;
  supplierId: string;
  supplierName: string;
  quantity: number;
  unitSupplierPriceToman: number;
  amountToman: number;
  appliedAmountToman: number;
  status: AdminSupplierCreditStatus;
  appliedAt: string | null;
  voidedAt: string | null;
  createdAt: string;
  updatedAt: string;
  order: Readonly<{
    id: string;
    orderNumber: string;
    status: string | null;
  }>;
  orderItem: Readonly<{
    id: string;
    productName: string;
    variantName: string | null;
    sku: string;
  }>;
  returnItem: Readonly<{
    id: string;
    returnId: string;
    quantity: number;
    disposition: string;
    returnStatus: string | null;
    returnReason: string | null;
    receiveNote: string | null;
  }>;
  createdBy: AdminSupplierCreditActor | null;
  applications: readonly AdminSupplierCreditApplication[];
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

function actor(value: unknown): AdminSupplierCreditActor | null | undefined {
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

function settlement(value: unknown): AdminSupplierCreditApplication['settlement'] | undefined {
  if (value === null || value === undefined) return null;
  const source = record(value);
  const id = text(source?.id);
  const status = text(source?.status);
  const totalAmountToman = integer(source?.totalAmountToman);
  const creditAppliedToman = integer(source?.creditAppliedToman);
  const rawPaidAmount = source?.paidAmountToman;
  const paidAmountToman =
    rawPaidAmount === null || rawPaidAmount === undefined ? null : integer(rawPaidAmount);
  const paidAt = nullableDate(source?.paidAt);
  if (
    !id ||
    !status ||
    totalAmountToman === null ||
    creditAppliedToman === null ||
    (rawPaidAmount !== null && rawPaidAmount !== undefined && paidAmountToman === null) ||
    (source?.paidAt !== null && source?.paidAt !== undefined && paidAt === null)
  ) {
    return undefined;
  }
  return { id, status, totalAmountToman, creditAppliedToman, paidAmountToman, paidAt };
}

function application(value: unknown): AdminSupplierCreditApplication | null {
  const source = record(value);
  const id = text(source?.id);
  const settlementId = text(source?.settlementId);
  const amountToman = integer(source?.amountToman);
  const status = source?.status ?? 'ACTIVE';
  const createdAt = date(source?.createdAt);
  const appliedBy = actor(source?.appliedBy);
  const removedBy = actor(source?.removedBy);
  const parsedSettlement = settlement(source?.settlement);
  const removedAt = nullableDate(source?.removedAt);
  if (
    !id ||
    !settlementId ||
    amountToman === null ||
    !includes(SUPPLIER_CREDIT_APPLICATION_STATUSES, status) ||
    !createdAt ||
    appliedBy === undefined ||
    removedBy === undefined ||
    parsedSettlement === undefined ||
    (source?.removedAt !== null && source?.removedAt !== undefined && removedAt === null)
  ) {
    return null;
  }
  return {
    id,
    settlementId,
    amountToman,
    status,
    removalReason: nullableText(source?.removalReason),
    removedAt,
    createdAt,
    appliedBy,
    removedBy,
    settlement: parsedSettlement,
  };
}

function supplierCredit(value: unknown): AdminSupplierCredit | null {
  const source = record(value);
  const order = record(source?.order);
  const orderItem = record(source?.orderItem);
  const returnItem = record(source?.returnItem);
  const orderReturn = record(returnItem?.orderReturn);
  const id = text(source?.id);
  const orderId = text(source?.orderId);
  const orderItemId = text(source?.orderItemId);
  const returnItemId = text(source?.returnItemId);
  const supplierId = text(source?.supplierIdSnapshot);
  const supplierName = text(source?.supplierNameSnapshot);
  const quantity = integer(source?.quantity);
  const unitSupplierPriceToman = integer(source?.unitSupplierPriceToman);
  const amountToman = integer(source?.amountToman);
  const appliedAmountToman = integer(source?.appliedAmountToman);
  const status = source?.status;
  const createdAt = date(source?.createdAt);
  const updatedAt = date(source?.updatedAt);
  const orderNumber = text(order?.orderNumber);
  const productName = text(orderItem?.productNameSnapshot);
  const sku = text(orderItem?.skuSnapshot);
  const returnId = text(returnItem?.returnId);
  const returnQuantity = integer(returnItem?.quantity);
  const disposition = text(returnItem?.disposition);
  const createdBy = actor(source?.createdBy);
  const rawApplications = source?.applications;
  if (
    !id ||
    !orderId ||
    !orderItemId ||
    !returnItemId ||
    !supplierId ||
    !supplierName ||
    quantity === null ||
    unitSupplierPriceToman === null ||
    amountToman === null ||
    appliedAmountToman === null ||
    appliedAmountToman > amountToman ||
    !includes(SUPPLIER_CREDIT_STATUSES, status) ||
    !createdAt ||
    !updatedAt ||
    !orderNumber ||
    !productName ||
    !sku ||
    !returnId ||
    returnQuantity === null ||
    !disposition ||
    createdBy === undefined ||
    !Array.isArray(rawApplications)
  ) {
    return null;
  }
  const applications = rawApplications.map(application);
  if (applications.some((candidate) => candidate === null)) return null;
  const appliedAt = nullableDate(source?.appliedAt);
  const voidedAt = nullableDate(source?.voidedAt);
  if (
    (source?.appliedAt !== null && source?.appliedAt !== undefined && appliedAt === null) ||
    (source?.voidedAt !== null && source?.voidedAt !== undefined && voidedAt === null)
  ) {
    return null;
  }
  return {
    id,
    orderId,
    orderItemId,
    returnItemId,
    supplierId,
    supplierName,
    quantity,
    unitSupplierPriceToman,
    amountToman,
    appliedAmountToman,
    status,
    appliedAt,
    voidedAt,
    createdAt,
    updatedAt,
    order: {
      id: text(order?.id) ?? orderId,
      orderNumber,
      status: nullableText(order?.status),
    },
    orderItem: {
      id: text(orderItem?.id) ?? orderItemId,
      productName,
      variantName: nullableText(orderItem?.variantNameSnapshot),
      sku,
    },
    returnItem: {
      id: text(returnItem?.id) ?? returnItemId,
      returnId,
      quantity: returnQuantity,
      disposition,
      returnStatus: nullableText(orderReturn?.status),
      returnReason: nullableText(orderReturn?.reason),
      receiveNote: nullableText(orderReturn?.receiveNote),
    },
    createdBy,
    applications: applications as AdminSupplierCreditApplication[],
  };
}

export function parseSupplierCredits(value: unknown): readonly AdminSupplierCredit[] | null {
  if (!Array.isArray(value)) return null;
  const credits = value.map(supplierCredit);
  return credits.some((credit) => credit === null) ? null : (credits as AdminSupplierCredit[]);
}

export function parseSupplierCredit(value: unknown): AdminSupplierCredit | null {
  return parseSupplierCredits([value])?.[0] ?? null;
}

export function supplierCreditRemainingAmount(credit: AdminSupplierCredit): number {
  if (credit.status === 'VOIDED') return 0;
  return Math.max(0, credit.amountToman - credit.appliedAmountToman);
}
