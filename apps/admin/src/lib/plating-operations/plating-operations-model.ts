export const PLATING_FULFILLMENT_STATUSES = [
  'PENDING',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
] as const;

export type AdminPlatingFulfillmentStatus = (typeof PLATING_FULFILLMENT_STATUSES)[number];
export type AdminPlatingSlaState =
  'ON_TRACK' | 'DUE_SOON' | 'OVERDUE' | 'ON_TIME' | 'LATE' | 'NONE';

export type AdminPlatingActor = Readonly<{
  id: string;
  phone: string;
  firstName: string | null;
  lastName: string | null;
}>;

export type AdminPlatingOrderItem = Readonly<{
  id: string;
  productName: string;
  variantName: string | null;
  sku: string;
  quantity: number;
  platingType: 'GOLD' | 'RHODIUM';
  platingWeightGrams: number | null;
  leadTimeDays: number | null;
}>;

export type AdminPlatingFulfillment = Readonly<{
  id: string;
  orderId: string;
  status: AdminPlatingFulfillmentStatus;
  actualCostToman: number | null;
  externalReference: string | null;
  startNote: string | null;
  completionNote: string | null;
  cancellationReason: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  startedBy: AdminPlatingActor | null;
  completedBy: AdminPlatingActor | null;
  cancelledBy: AdminPlatingActor | null;
}>;

export type AdminPlatingOrder = Readonly<{
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  paidAt: string | null;
  platingTotalToman: number;
  items: readonly AdminPlatingOrderItem[];
  fulfillmentStatus: AdminPlatingFulfillmentStatus;
  fulfillment: AdminPlatingFulfillment | null;
}>;

export type AdminPlatingSla = Readonly<{
  state: AdminPlatingSlaState;
  deadline: string | null;
  remainingMs: number | null;
  leadTimeDays: number | null;
}>;

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function nullableText(value: unknown): string | null {
  return value === null || value === undefined ? null : text(value);
}

function number(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function integer(value: unknown): number | null {
  const parsed = number(value);
  return parsed !== null && Number.isInteger(parsed) ? parsed : null;
}

function date(value: unknown): string | null {
  const candidate = text(value);
  return candidate && !Number.isNaN(Date.parse(candidate)) ? candidate : null;
}

function nullableDate(value: unknown): string | null {
  return value === null || value === undefined ? null : date(value);
}

function actor(value: unknown): AdminPlatingActor | null | undefined {
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

function isStatus(value: unknown): value is AdminPlatingFulfillmentStatus {
  return (
    typeof value === 'string' &&
    PLATING_FULFILLMENT_STATUSES.some((candidate) => candidate === value)
  );
}

function parseItem(value: unknown): AdminPlatingOrderItem | null {
  const source = record(value);
  const id = text(source?.id);
  const productName = text(source?.productNameSnapshot);
  const sku = text(source?.skuSnapshot);
  const quantity = integer(source?.quantity);
  const platingType = text(source?.platingType);
  const rawWeight = source?.platingWeightGrams;
  const rawLeadTime = source?.platingLeadTimeDays;
  const platingWeightGrams = rawWeight === null ? null : number(rawWeight);
  const leadTimeDays = rawLeadTime === null ? null : integer(rawLeadTime);
  if (
    !id ||
    !productName ||
    !sku ||
    quantity === null ||
    (platingType !== 'GOLD' && platingType !== 'RHODIUM') ||
    (platingWeightGrams === null && rawWeight !== null) ||
    (leadTimeDays === null && rawLeadTime !== null)
  ) {
    return null;
  }
  return {
    id,
    productName,
    variantName: nullableText(source?.variantNameSnapshot),
    sku,
    quantity,
    platingType,
    platingWeightGrams,
    leadTimeDays,
  };
}

function parseFulfillment(value: unknown): AdminPlatingFulfillment | null | undefined {
  if (value === null || value === undefined) return null;
  const source = record(value);
  const startedBy = actor(source?.startedBy);
  const completedBy = actor(source?.completedBy);
  const cancelledBy = actor(source?.cancelledBy);
  const id = text(source?.id);
  const orderId = text(source?.orderId);
  const createdAt = date(source?.createdAt);
  const updatedAt = date(source?.updatedAt);
  const rawCost = source?.actualCostToman;
  const actualCostToman = rawCost === null ? null : integer(rawCost);
  const status = source?.status;
  if (
    !id ||
    !orderId ||
    !isStatus(status) ||
    !createdAt ||
    !updatedAt ||
    startedBy === undefined ||
    completedBy === undefined ||
    cancelledBy === undefined ||
    (actualCostToman === null && rawCost !== null)
  ) {
    return undefined;
  }
  return {
    id,
    orderId,
    status,
    actualCostToman,
    externalReference: nullableText(source?.externalReference),
    startNote: nullableText(source?.startNote),
    completionNote: nullableText(source?.completionNote),
    cancellationReason: nullableText(source?.cancellationReason),
    startedAt: nullableDate(source?.startedAt),
    completedAt: nullableDate(source?.completedAt),
    cancelledAt: nullableDate(source?.cancelledAt),
    createdAt,
    updatedAt,
    startedBy,
    completedBy,
    cancelledBy,
  };
}

function parseOrder(value: unknown): AdminPlatingOrder | null {
  const source = record(value);
  const orderId = text(source?.orderId);
  const orderNumber = text(source?.orderNumber);
  const orderStatus = text(source?.orderStatus);
  const paidAt = nullableDate(source?.paidAt);
  const platingTotalToman = integer(source?.platingTotalToman);
  const fulfillment = parseFulfillment(source?.fulfillment);
  const fulfillmentStatus = source?.fulfillmentStatus;
  const rawItems = source?.items;
  if (!Array.isArray(rawItems)) return null;
  const items = rawItems.map(parseItem);
  if (
    !orderId ||
    !orderNumber ||
    !orderStatus ||
    platingTotalToman === null ||
    !isStatus(fulfillmentStatus) ||
    fulfillment === undefined ||
    items.some((item) => item === null)
  ) {
    return null;
  }
  return {
    orderId,
    orderNumber,
    orderStatus,
    paidAt,
    platingTotalToman,
    items: items as AdminPlatingOrderItem[],
    fulfillmentStatus,
    fulfillment,
  };
}

export function parsePlatingOperations(value: unknown): readonly AdminPlatingOrder[] | null {
  if (!Array.isArray(value)) return null;
  const orders = value.map(parseOrder);
  return orders.some((order) => order === null) ? null : (orders as AdminPlatingOrder[]);
}

export function getPlatingSla(order: AdminPlatingOrder, now = Date.now()): AdminPlatingSla {
  const leadTimeDays = order.items.reduce<number | null>((maximum, item) => {
    if (item.leadTimeDays === null) return maximum;
    return maximum === null ? item.leadTimeDays : Math.max(maximum, item.leadTimeDays);
  }, null);
  if (!order.paidAt || leadTimeDays === null) {
    return { state: 'NONE', deadline: null, remainingMs: null, leadTimeDays };
  }
  const deadlineMs = new Date(order.paidAt).getTime() + leadTimeDays * 86_400_000;
  const completionMs = order.fulfillment?.completedAt
    ? new Date(order.fulfillment.completedAt).getTime()
    : null;
  if (order.fulfillmentStatus === 'COMPLETED' && completionMs !== null) {
    return {
      state: completionMs <= deadlineMs ? 'ON_TIME' : 'LATE',
      deadline: new Date(deadlineMs).toISOString(),
      remainingMs: deadlineMs - completionMs,
      leadTimeDays,
    };
  }
  if (order.fulfillmentStatus === 'CANCELLED') {
    return {
      state: 'NONE',
      deadline: new Date(deadlineMs).toISOString(),
      remainingMs: null,
      leadTimeDays,
    };
  }
  const remainingMs = deadlineMs - now;
  return {
    state: remainingMs < 0 ? 'OVERDUE' : remainingMs <= 86_400_000 ? 'DUE_SOON' : 'ON_TRACK',
    deadline: new Date(deadlineMs).toISOString(),
    remainingMs,
    leadTimeDays,
  };
}

export function platingActorLabel(actor: AdminPlatingActor | null): string {
  if (!actor) return 'ثبت نشده';
  const name = [actor.firstName, actor.lastName].filter(Boolean).join(' ');
  return name || actor.phone;
}
