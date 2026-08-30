import {
  OrderStatus,
  PlatingFulfillmentStatus,
  ShipmentProviderCreationState,
  ShipmentStatus,
} from '../../generated/prisma/enums';
import { buildFulfillmentReadiness, type FulfillmentReadinessInput } from './fulfillment-readiness';
import { PROVIDER_CREATION_STALE_MS, SLA_DAY_MS } from './fulfillment-sla.constants';

export type OperationsWorkType = 'PLATING' | 'SHIPPING';
export type OperationsWorkQueueState = 'READY' | 'BLOCKED' | 'OVERDUE';
export type OperationsWorkPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'NORMAL';

export type OperationsWorkCode =
  | 'PLATING_NOT_STARTED'
  | 'PLATING_IN_PROGRESS'
  | 'PLATING_OVERDUE'
  | 'PLATING_CANCELLED'
  | 'SHIPPING_NOT_SELECTED'
  | 'READY_FOR_SHIPMENT_CREATION'
  | 'SHIPMENT_CREATION_IN_PROGRESS'
  | 'SHIPMENT_CREATION_STALE'
  | 'SHIPMENT_PROVIDER_RECONCILIATION_REQUIRED'
  | 'READY_FOR_HANDOFF';

export type OperationsWorkQueueInput = FulfillmentReadinessInput & {
  items: Array<{
    platingLeadTimeDays: number | null;
  }>;
  platingFulfillment: {
    status: PlatingFulfillmentStatus;
    startedAt: Date | null;
    cancelledAt: Date | null;
  } | null;
  shipment:
    | (NonNullable<FulfillmentReadinessInput['shipment']> & {
        updatedAt: Date;
      })
    | null;
};

export type OperationsWorkItem = {
  orderId: string;
  orderNumber: string;
  orderStatus: OrderStatus;
  workType: OperationsWorkType;
  code: OperationsWorkCode;
  state: OperationsWorkQueueState;
  priority: OperationsWorkPriority;
  dueAt: Date | null;
  overdue: boolean;
  ageMinutes: number | null;
  context: Record<string, unknown>;
};

const WORK_CODE_RANK: Record<OperationsWorkCode, number> = {
  SHIPMENT_PROVIDER_RECONCILIATION_REQUIRED: 10,
  PLATING_CANCELLED: 15,
  PLATING_OVERDUE: 20,
  SHIPMENT_CREATION_STALE: 30,
  SHIPPING_NOT_SELECTED: 35,
  READY_FOR_HANDOFF: 40,
  PLATING_NOT_STARTED: 50,
  READY_FOR_SHIPMENT_CREATION: 60,
  SHIPMENT_CREATION_IN_PROGRESS: 70,
  PLATING_IN_PROGRESS: 80,
};

export function buildOperationsWorkItems(
  input: OperationsWorkQueueInput,
  now = new Date(),
): OperationsWorkItem[] {
  const readiness = buildFulfillmentReadiness(input);
  const items: OperationsWorkItem[] = [];

  addPlatingWork(items, input, now);
  addShippingWork(items, input, readiness, now);

  return sortOperationsWorkItems(items);
}

export function sortOperationsWorkItems(items: OperationsWorkItem[]): OperationsWorkItem[] {
  return [...items].sort((a, b) => {
    const byCode = WORK_CODE_RANK[a.code] - WORK_CODE_RANK[b.code];

    if (byCode !== 0) {
      return byCode;
    }

    const aDue = a.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const bDue = b.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER;

    if (aDue !== bDue) {
      return aDue - bDue;
    }

    const aAge = a.ageMinutes ?? -1;
    const bAge = b.ageMinutes ?? -1;

    return bAge - aAge;
  });
}

export function summarizeOperationsWorkItems(items: OperationsWorkItem[]) {
  return {
    total: items.length,
    uniqueOrderCount: new Set(items.map((item) => item.orderId)).size,
    ready: items.filter((item) => item.state === 'READY').length,
    blocked: items.filter((item) => item.state === 'BLOCKED').length,
    overdue: items.filter((item) => item.state === 'OVERDUE').length,
    reconciliationRequired: countCode(items, 'SHIPMENT_PROVIDER_RECONCILIATION_REQUIRED'),
    platingPending: countCode(items, 'PLATING_NOT_STARTED'),
    platingInProgress: countCode(items, 'PLATING_IN_PROGRESS'),
    platingOverdue: countCode(items, 'PLATING_OVERDUE'),
    platingCancelled: countCode(items, 'PLATING_CANCELLED'),
    shippingNotSelected: countCode(items, 'SHIPPING_NOT_SELECTED'),
    shipmentReady: countCode(items, 'READY_FOR_SHIPMENT_CREATION'),
    shipmentInProgress: countCode(items, 'SHIPMENT_CREATION_IN_PROGRESS'),
    shipmentStale: countCode(items, 'SHIPMENT_CREATION_STALE'),
    shipmentReadyForHandoff: countCode(items, 'READY_FOR_HANDOFF'),
  };
}

function addPlatingWork(items: OperationsWorkItem[], input: OperationsWorkQueueInput, now: Date) {
  if (input.platingTotalToman <= 0) {
    return;
  }

  const status = input.platingFulfillment?.status ?? PlatingFulfillmentStatus.PENDING;

  if (status === PlatingFulfillmentStatus.COMPLETED) {
    return;
  }

  const maxLeadTimeDays = maximumPlatingLeadTimeDays(input.items);
  const anchor = input.platingFulfillment?.startedAt ?? input.paidAt;
  const dueAt =
    anchor && maxLeadTimeDays !== null
      ? new Date(anchor.getTime() + maxLeadTimeDays * SLA_DAY_MS)
      : null;

  if (status === PlatingFulfillmentStatus.CANCELLED) {
    items.push({
      orderId: input.id,
      orderNumber: input.orderNumber,
      orderStatus: input.status,
      workType: 'PLATING',
      code: 'PLATING_CANCELLED',
      state: 'BLOCKED',
      priority: 'CRITICAL',
      dueAt,
      overdue: false,
      ageMinutes: ageMinutes(anchor, now),
      context: {
        phase: 'CANCELLED',
        maxLeadTimeDays,
        incidentAt:
          input.platingFulfillment?.cancelledAt?.toISOString() ?? anchor?.toISOString() ?? null,
      },
    });
    return;
  }

  const overdue = dueAt !== null && now.getTime() > dueAt.getTime();

  if (overdue) {
    items.push({
      orderId: input.id,
      orderNumber: input.orderNumber,
      orderStatus: input.status,
      workType: 'PLATING',
      code: 'PLATING_OVERDUE',
      state: 'OVERDUE',
      priority: 'HIGH',
      dueAt,
      overdue: true,
      ageMinutes: ageMinutes(anchor, now),
      context: {
        phase: status === PlatingFulfillmentStatus.IN_PROGRESS ? 'IN_PROGRESS' : 'NOT_STARTED',
        maxLeadTimeDays,
      },
    });
    return;
  }

  if (status === PlatingFulfillmentStatus.IN_PROGRESS) {
    items.push({
      orderId: input.id,
      orderNumber: input.orderNumber,
      orderStatus: input.status,
      workType: 'PLATING',
      code: 'PLATING_IN_PROGRESS',
      state: 'BLOCKED',
      priority: 'NORMAL',
      dueAt,
      overdue: false,
      ageMinutes: ageMinutes(anchor, now),
      context: {
        phase: 'IN_PROGRESS',
        maxLeadTimeDays,
      },
    });
    return;
  }

  items.push({
    orderId: input.id,
    orderNumber: input.orderNumber,
    orderStatus: input.status,
    workType: 'PLATING',
    code: 'PLATING_NOT_STARTED',
    state: 'BLOCKED',
    priority: 'MEDIUM',
    dueAt,
    overdue: false,
    ageMinutes: ageMinutes(anchor, now),
    context: {
      phase: 'NOT_STARTED',
      maxLeadTimeDays,
    },
  });
}

function addShippingWork(
  items: OperationsWorkItem[],
  input: OperationsWorkQueueInput,
  readiness: ReturnType<typeof buildFulfillmentReadiness>,
  now: Date,
) {
  const shipment = input.shipment;

  if (!shipment) {
    items.push({
      orderId: input.id,
      orderNumber: input.orderNumber,
      orderStatus: input.status,
      workType: 'SHIPPING',
      code: 'SHIPPING_NOT_SELECTED',
      state: 'BLOCKED',
      priority: 'HIGH',
      dueAt: null,
      overdue: false,
      ageMinutes: ageMinutes(input.paidAt, now),
      context: {},
    });
    return;
  }

  const providerCreationInconsistent =
    shipment.providerCreationState === ShipmentProviderCreationState.UNKNOWN ||
    (shipment.providerCreationState === ShipmentProviderCreationState.CREATED &&
      !shipment.providerShipmentId) ||
    (shipment.providerShipmentId !== null &&
      !new Set<ShipmentStatus>([
        ShipmentStatus.READY,
        ShipmentStatus.HANDED_OVER,
        ShipmentStatus.IN_TRANSIT,
        ShipmentStatus.DELIVERED,
      ]).has(shipment.status));

  if (providerCreationInconsistent) {
    items.push({
      orderId: input.id,
      orderNumber: input.orderNumber,
      orderStatus: input.status,
      workType: 'SHIPPING',
      code: 'SHIPMENT_PROVIDER_RECONCILIATION_REQUIRED',
      state: 'BLOCKED',
      priority: 'CRITICAL',
      dueAt: null,
      overdue: false,
      ageMinutes: ageMinutes(shipment.creationAttemptedAt ?? input.paidAt, now),
      context: {
        provider: shipment.provider,
        providerCreationState: shipment.providerCreationState,
        providerShipmentId: shipment.providerShipmentId,
        providerCreateError: shipment.providerCreateError,
        incidentAt:
          (shipment.creationAttemptedAt ?? shipment.updatedAt ?? input.paidAt)?.toISOString() ??
          null,
      },
    });
    return;
  }

  if (shipment.providerCreationState === ShipmentProviderCreationState.IN_PROGRESS) {
    if (!shipment.creationAttemptedAt) {
      items.push({
        orderId: input.id,
        orderNumber: input.orderNumber,
        orderStatus: input.status,
        workType: 'SHIPPING',
        code: 'SHIPMENT_PROVIDER_RECONCILIATION_REQUIRED',
        state: 'BLOCKED',
        priority: 'CRITICAL',
        dueAt: null,
        overdue: false,
        ageMinutes: ageMinutes(input.paidAt, now),
        context: {
          provider: shipment.provider,
          providerCreationState: shipment.providerCreationState,
          providerCreateError: shipment.providerCreateError,
          reason: 'MISSING_CREATION_ATTEMPT_TIMESTAMP',
          incidentAt: (shipment.updatedAt ?? input.paidAt)?.toISOString() ?? null,
        },
      });
      return;
    }

    const dueAt = new Date(shipment.creationAttemptedAt.getTime() + PROVIDER_CREATION_STALE_MS);
    const stale = now.getTime() > dueAt.getTime();

    items.push({
      orderId: input.id,
      orderNumber: input.orderNumber,
      orderStatus: input.status,
      workType: 'SHIPPING',
      code: stale ? 'SHIPMENT_CREATION_STALE' : 'SHIPMENT_CREATION_IN_PROGRESS',
      state: stale ? 'OVERDUE' : 'BLOCKED',
      priority: stale ? 'HIGH' : 'NORMAL',
      dueAt,
      overdue: stale,
      ageMinutes: ageMinutes(shipment.creationAttemptedAt, now),
      context: {
        provider: shipment.provider,
        providerCreationState: shipment.providerCreationState,
      },
    });
    return;
  }

  if (readiness.readyForHandoff && shipment.status === ShipmentStatus.READY) {
    items.push({
      orderId: input.id,
      orderNumber: input.orderNumber,
      orderStatus: input.status,
      workType: 'SHIPPING',
      code: 'READY_FOR_HANDOFF',
      state: 'READY',
      priority: 'MEDIUM',
      dueAt: null,
      overdue: false,
      ageMinutes: ageMinutes(shipment.creationAttemptedAt ?? input.paidAt, now),
      context: {
        provider: shipment.provider,
        providerShipmentId: shipment.providerShipmentId,
      },
    });
    return;
  }

  if (readiness.readyForShipmentCreation) {
    items.push({
      orderId: input.id,
      orderNumber: input.orderNumber,
      orderStatus: input.status,
      workType: 'SHIPPING',
      code: 'READY_FOR_SHIPMENT_CREATION',
      state: 'READY',
      priority: 'MEDIUM',
      dueAt: null,
      overdue: false,
      ageMinutes: ageMinutes(input.paidAt, now),
      context: {
        provider: shipment.provider,
      },
    });
  }
}

function maximumPlatingLeadTimeDays(items: OperationsWorkQueueInput['items']): number | null {
  const values = items
    .map((item) => item.platingLeadTimeDays)
    .filter((value): value is number => value !== null);

  if (values.length === 0) {
    return null;
  }

  return Math.max(...values);
}

function ageMinutes(anchor: Date | null, now: Date): number | null {
  if (!anchor) {
    return null;
  }

  return Math.max(0, Math.floor((now.getTime() - anchor.getTime()) / 60_000));
}

function countCode(items: OperationsWorkItem[], code: OperationsWorkCode) {
  return items.filter((item) => item.code === code).length;
}
