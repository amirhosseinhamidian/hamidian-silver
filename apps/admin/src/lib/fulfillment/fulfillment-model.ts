export const FULFILLMENT_WORK_TYPES = ['PLATING', 'SHIPPING'] as const;
export const FULFILLMENT_WORK_STATES = ['READY', 'BLOCKED', 'OVERDUE'] as const;
export const FULFILLMENT_PRIORITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'NORMAL'] as const;
export const FULFILLMENT_WORK_CODES = [
  'PLATING_NOT_STARTED',
  'PLATING_IN_PROGRESS',
  'PLATING_OVERDUE',
  'PLATING_CANCELLED',
  'SHIPPING_NOT_SELECTED',
  'READY_FOR_SHIPMENT_CREATION',
  'SHIPMENT_CREATION_IN_PROGRESS',
  'SHIPMENT_CREATION_STALE',
  'SHIPMENT_PROVIDER_RECONCILIATION_REQUIRED',
  'READY_FOR_HANDOFF',
] as const;

export type AdminFulfillmentWorkType = (typeof FULFILLMENT_WORK_TYPES)[number];
export type AdminFulfillmentWorkState = (typeof FULFILLMENT_WORK_STATES)[number];
export type AdminFulfillmentPriority = (typeof FULFILLMENT_PRIORITIES)[number];
export type AdminFulfillmentWorkCode = (typeof FULFILLMENT_WORK_CODES)[number];

export type AdminFulfillmentContext = Readonly<{
  phase: string | null;
  maxLeadTimeDays: number | null;
  provider: string | null;
  providerCreationState: string | null;
  providerShipmentId: string | null;
  providerCreateError: string | null;
  reason: string | null;
  incidentAt: string | null;
}>;

export type AdminFulfillmentWorkItem = Readonly<{
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  workType: AdminFulfillmentWorkType;
  code: AdminFulfillmentWorkCode;
  state: AdminFulfillmentWorkState;
  priority: AdminFulfillmentPriority;
  dueAt: string | null;
  overdue: boolean;
  ageMinutes: number | null;
  context: AdminFulfillmentContext;
}>;

export type AdminFulfillmentQueue = Readonly<{
  generatedAt: string;
  type: AdminFulfillmentWorkType | null;
  state: AdminFulfillmentWorkState | null;
  totalMatched: number;
  count: number;
  items: readonly AdminFulfillmentWorkItem[];
}>;

export type AdminFulfillmentSummary = Readonly<{
  generatedAt: string;
  total: number;
  uniqueOrderCount: number;
  ready: number;
  blocked: number;
  overdue: number;
  reconciliationRequired: number;
  platingPending: number;
  platingInProgress: number;
  platingOverdue: number;
  platingCancelled: number;
  shippingNotSelected: number;
  shipmentReady: number;
  shipmentInProgress: number;
  shipmentStale: number;
  shipmentReadyForHandoff: number;
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

function number(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function nonNegativeInteger(value: unknown): number | null {
  const candidate = number(value);
  return candidate !== null && Number.isInteger(candidate) && candidate >= 0 ? candidate : null;
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

function parseContext(value: unknown): AdminFulfillmentContext | null {
  const source = record(value);
  if (!source) return null;
  const rawLeadTime = source.maxLeadTimeDays;
  const maxLeadTimeDays =
    rawLeadTime === null || rawLeadTime === undefined ? null : nonNegativeInteger(rawLeadTime);
  if (maxLeadTimeDays === null && rawLeadTime !== null && rawLeadTime !== undefined) return null;
  return {
    phase: nullableText(source.phase),
    maxLeadTimeDays,
    provider: nullableText(source.provider),
    providerCreationState: nullableText(source.providerCreationState),
    providerShipmentId: nullableText(source.providerShipmentId),
    providerCreateError: nullableText(source.providerCreateError),
    reason: nullableText(source.reason),
    incidentAt: nullableDate(source.incidentAt),
  };
}

function parseWorkItem(value: unknown): AdminFulfillmentWorkItem | null {
  const source = record(value);
  const orderId = text(source?.orderId);
  const orderNumber = text(source?.orderNumber);
  const orderStatus = text(source?.orderStatus);
  const workType = source?.workType;
  const code = source?.code;
  const state = source?.state;
  const priority = source?.priority;
  const context = parseContext(source?.context);
  const rawAge = source?.ageMinutes;
  const ageMinutes = rawAge === null ? null : nonNegativeInteger(rawAge);
  const overdue = source?.overdue;
  if (
    !orderId ||
    !orderNumber ||
    !orderStatus ||
    !includes(FULFILLMENT_WORK_TYPES, workType) ||
    !includes(FULFILLMENT_WORK_CODES, code) ||
    !includes(FULFILLMENT_WORK_STATES, state) ||
    !includes(FULFILLMENT_PRIORITIES, priority) ||
    !context ||
    (ageMinutes === null && rawAge !== null) ||
    typeof overdue !== 'boolean'
  ) {
    return null;
  }
  return {
    orderId,
    orderNumber,
    orderStatus,
    workType,
    code,
    state,
    priority,
    dueAt: nullableDate(source?.dueAt),
    overdue,
    ageMinutes,
    context,
  };
}

export function parseFulfillmentQueue(value: unknown): AdminFulfillmentQueue | null {
  const source = record(value);
  const generatedAt = date(source?.generatedAt);
  const totalMatched = nonNegativeInteger(source?.totalMatched);
  const count = nonNegativeInteger(source?.count);
  const rawType = source?.type;
  const rawState = source?.state;
  const rawItems = source?.items;
  const type = rawType === null ? null : includes(FULFILLMENT_WORK_TYPES, rawType) ? rawType : null;
  const state =
    rawState === null ? null : includes(FULFILLMENT_WORK_STATES, rawState) ? rawState : null;
  if (
    !generatedAt ||
    totalMatched === null ||
    count === null ||
    !Array.isArray(rawItems) ||
    (rawType !== null && type === null) ||
    (rawState !== null && state === null)
  ) {
    return null;
  }
  const items = rawItems.map(parseWorkItem);
  if (items.some((item) => item === null)) return null;
  return {
    generatedAt,
    type,
    state,
    totalMatched,
    count,
    items: items as AdminFulfillmentWorkItem[],
  };
}

const SUMMARY_KEYS = [
  'total',
  'uniqueOrderCount',
  'ready',
  'blocked',
  'overdue',
  'reconciliationRequired',
  'platingPending',
  'platingInProgress',
  'platingOverdue',
  'platingCancelled',
  'shippingNotSelected',
  'shipmentReady',
  'shipmentInProgress',
  'shipmentStale',
  'shipmentReadyForHandoff',
] as const;

export function parseFulfillmentSummary(value: unknown): AdminFulfillmentSummary | null {
  const source = record(value);
  const generatedAt = date(source?.generatedAt);
  if (!source || !generatedAt) return null;
  const counts = Object.fromEntries(
    SUMMARY_KEYS.map((key) => [key, nonNegativeInteger(source[key])]),
  ) as Record<(typeof SUMMARY_KEYS)[number], number | null>;
  if (SUMMARY_KEYS.some((key) => counts[key] === null)) return null;
  return {
    generatedAt,
    ...counts,
  } as AdminFulfillmentSummary;
}

export function fulfillmentWorkDestination(
  item: AdminFulfillmentWorkItem,
): '/plating' | '/shipping' {
  return item.workType === 'PLATING' ? '/plating' : '/shipping';
}

export function formatFulfillmentAge(minutes: number | null): string {
  if (minutes === null) return 'نامشخص';
  if (minutes < 60) return `${Math.floor(minutes)} دقیقه`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ساعت`;
  return `${Math.floor(hours / 24)} روز`;
}
