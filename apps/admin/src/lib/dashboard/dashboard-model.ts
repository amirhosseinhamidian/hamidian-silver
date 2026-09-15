export type DashboardPeriod = '24h' | '7d' | '30d';

export type DashboardFinance = Readonly<{
  paidOrderCount: number;
  grossSalesToman: number;
  netCollectedRevenueToman: number;
}>;

export type DashboardOperations = Readonly<{
  total: number;
  uniqueOrderCount: number;
  ready: number;
  blocked: number;
  overdue: number;
  reconciliationRequired: number;
  platingPending: number;
  platingInProgress: number;
  shipmentReady: number;
  shipmentReadyForHandoff: number;
}>;

export type DashboardAlerts = Readonly<{
  activeIncidentCount: number;
  critical: number;
  overdue: number;
  reconciliationRequired: number;
}>;

export type DashboardInventory = Readonly<{
  stockRecordCount: number;
  availableUnits: number;
  reservedUnits: number;
  lowStockCount: number;
  outOfStockCount: number;
}>;

export type DashboardOrderStatus =
  'PENDING_PAYMENT' | 'PAID' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'EXPIRED';

export type DashboardOrder = Readonly<{
  id: string;
  orderNumber: string;
  status: DashboardOrderStatus;
  grandTotalToman: number;
  createdAt: string;
  customerName: string | null;
  customerPhone: string;
  itemCount: number;
}>;

export type DashboardWorkItem = Readonly<{
  orderId: string;
  orderNumber: string;
  workType: 'PLATING' | 'SHIPPING';
  code: string;
  state: 'READY' | 'BLOCKED' | 'OVERDUE';
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'NORMAL';
  dueAt: string | null;
  ageMinutes: number | null;
}>;

type UnknownRecord = Record<string, unknown>;

const ORDER_STATUSES: ReadonlySet<DashboardOrderStatus> = new Set([
  'PENDING_PAYMENT',
  'PAID',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'EXPIRED',
]);

const WORK_TYPES: ReadonlySet<DashboardWorkItem['workType']> = new Set(['PLATING', 'SHIPPING']);
const WORK_STATES: ReadonlySet<DashboardWorkItem['state']> = new Set([
  'READY',
  'BLOCKED',
  'OVERDUE',
]);
const WORK_PRIORITIES: ReadonlySet<DashboardWorkItem['priority']> = new Set([
  'CRITICAL',
  'HIGH',
  'MEDIUM',
  'NORMAL',
]);

function record(value: unknown): UnknownRecord | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function nonNegativeNumber(value: unknown): number {
  return Math.max(0, finiteNumber(value) ?? 0);
}

function string(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function parseDashboardPeriod(value: string | string[] | undefined): DashboardPeriod {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate === '7d' || candidate === '30d' ? candidate : '24h';
}

export function dashboardPeriodStart(period: DashboardPeriod, now = new Date()): Date {
  const durationHours = period === '24h' ? 24 : period === '7d' ? 24 * 7 : 24 * 30;
  return new Date(now.getTime() - durationHours * 60 * 60 * 1_000);
}

export function parseFinance(value: unknown): DashboardFinance | null {
  const source = record(value);
  if (!source) return null;

  return {
    paidOrderCount: nonNegativeNumber(source.paidOrderCount),
    grossSalesToman: nonNegativeNumber(source.grossSalesToman),
    netCollectedRevenueToman: finiteNumber(source.netCollectedRevenueToman) ?? 0,
  };
}

export function parseOperations(value: unknown): DashboardOperations | null {
  const source = record(value);
  if (!source) return null;

  return {
    total: nonNegativeNumber(source.total),
    uniqueOrderCount: nonNegativeNumber(source.uniqueOrderCount),
    ready: nonNegativeNumber(source.ready),
    blocked: nonNegativeNumber(source.blocked),
    overdue: nonNegativeNumber(source.overdue),
    reconciliationRequired: nonNegativeNumber(source.reconciliationRequired),
    platingPending: nonNegativeNumber(source.platingPending),
    platingInProgress: nonNegativeNumber(source.platingInProgress),
    shipmentReady: nonNegativeNumber(source.shipmentReady),
    shipmentReadyForHandoff: nonNegativeNumber(source.shipmentReadyForHandoff),
  };
}

export function parseAlerts(value: unknown): DashboardAlerts | null {
  const source = record(value);
  if (!source) return null;

  return {
    activeIncidentCount: nonNegativeNumber(source.activeIncidentCount),
    critical: nonNegativeNumber(source.critical),
    overdue: nonNegativeNumber(source.overdue),
    reconciliationRequired: nonNegativeNumber(source.reconciliationRequired),
  };
}

export function parseInventory(value: unknown): DashboardInventory | null {
  if (!Array.isArray(value)) return null;

  return value.reduce<DashboardInventory>(
    (summary, entry) => {
      const item = record(entry);
      if (!item) return summary;

      const available = nonNegativeNumber(item.available);
      const reserved = nonNegativeNumber(item.reserved);
      const lowStock = item.isLowStock === true;

      return {
        stockRecordCount: summary.stockRecordCount + 1,
        availableUnits: summary.availableUnits + available,
        reservedUnits: summary.reservedUnits + reserved,
        lowStockCount: summary.lowStockCount + (lowStock ? 1 : 0),
        outOfStockCount: summary.outOfStockCount + (available === 0 ? 1 : 0),
      };
    },
    {
      stockRecordCount: 0,
      availableUnits: 0,
      reservedUnits: 0,
      lowStockCount: 0,
      outOfStockCount: 0,
    },
  );
}

export function parseOrders(value: unknown): readonly DashboardOrder[] | null {
  if (!Array.isArray(value)) return null;

  return value.flatMap((entry) => {
    const order = record(entry);
    const user = record(order?.user);
    const id = string(order?.id);
    const orderNumber = string(order?.orderNumber);
    const status = string(order?.status) as DashboardOrderStatus | null;
    const createdAt = string(order?.createdAt);
    const customerPhone = string(user?.phone);

    if (
      !order ||
      !id ||
      !orderNumber ||
      !status ||
      !ORDER_STATUSES.has(status) ||
      !createdAt ||
      !customerPhone
    ) {
      return [];
    }

    const firstName = string(user?.firstName);
    const lastName = string(user?.lastName);
    const customerName = [firstName, lastName].filter(Boolean).join(' ') || null;

    return [
      {
        id,
        orderNumber,
        status,
        grandTotalToman: nonNegativeNumber(order.grandTotalToman),
        createdAt,
        customerName,
        customerPhone,
        itemCount: Array.isArray(order.items) ? order.items.length : 0,
      },
    ];
  });
}

export function parseWorkItems(value: unknown): readonly DashboardWorkItem[] | null {
  const source = record(value);
  if (!source || !Array.isArray(source.items)) return null;

  return source.items.flatMap((entry) => {
    const item = record(entry);
    const orderId = string(item?.orderId);
    const orderNumber = string(item?.orderNumber);
    const workType = string(item?.workType) as DashboardWorkItem['workType'] | null;
    const state = string(item?.state) as DashboardWorkItem['state'] | null;
    const priority = string(item?.priority) as DashboardWorkItem['priority'] | null;
    const code = string(item?.code);

    if (
      !item ||
      !orderId ||
      !orderNumber ||
      !workType ||
      !WORK_TYPES.has(workType) ||
      !state ||
      !WORK_STATES.has(state) ||
      !priority ||
      !WORK_PRIORITIES.has(priority) ||
      !code
    ) {
      return [];
    }

    return [
      {
        orderId,
        orderNumber,
        workType,
        code,
        state,
        priority,
        dueAt: string(item.dueAt),
        ageMinutes: finiteNumber(item.ageMinutes),
      },
    ];
  });
}
