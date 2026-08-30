import {
  OrderStatus,
  PlatingFulfillmentStatus,
  ShipmentProviderCreationState,
  ShipmentStatus,
} from '../../generated/prisma/enums';

export type FulfillmentReadinessState = 'READY' | 'BLOCKED';

export type FulfillmentReadinessBlockerCode =
  | 'ORDER_NOT_PAID'
  | 'ORDER_CLOSED'
  | 'ORDER_ALREADY_FULFILLED'
  | 'SHIPPING_NOT_SELECTED'
  | 'PLATING_NOT_STARTED'
  | 'PLATING_IN_PROGRESS'
  | 'PLATING_CANCELLED'
  | 'SHIPMENT_CREATION_IN_PROGRESS'
  | 'SHIPMENT_PROVIDER_RECONCILIATION_REQUIRED'
  | 'SHIPMENT_ALREADY_CREATED'
  | 'SHIPMENT_NOT_PENDING';

export type FulfillmentHandoffBlockerCode =
  | 'ORDER_NOT_PAID'
  | 'ORDER_CLOSED'
  | 'SHIPPING_NOT_SELECTED'
  | 'PLATING_NOT_STARTED'
  | 'PLATING_IN_PROGRESS'
  | 'PLATING_CANCELLED'
  | 'PROVIDER_SHIPMENT_NOT_CREATED'
  | 'SHIPMENT_NOT_READY_FOR_HANDOFF';

export type FulfillmentReadinessInput = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paidAt: Date | null;
  platingTotalToman: number;
  platingFulfillment: {
    status: PlatingFulfillmentStatus;
  } | null;
  shipment: {
    id: string;
    status: ShipmentStatus;
    provider: string;
    providerCreationState: ShipmentProviderCreationState;
    providerShipmentId: string | null;
    providerCreateError: string | null;
    creationAttemptedAt: Date | null;
  } | null;
};

export function buildFulfillmentReadiness(input: FulfillmentReadinessInput) {
  const paymentCheck =
    input.status === OrderStatus.PENDING_PAYMENT
      ? 'BLOCKED'
      : input.status === OrderStatus.CANCELLED || input.status === OrderStatus.EXPIRED
        ? 'CLOSED'
        : 'READY';

  const platingCheck = resolvePlatingCheck(input);
  const shippingSelectionCheck = input.shipment ? 'READY' : 'BLOCKED';
  const providerCreationCheck = resolveProviderCreationCheck(input);

  const creationBlockers: Array<{
    code: FulfillmentReadinessBlockerCode;
  }> = [];

  if (input.status === OrderStatus.PENDING_PAYMENT) {
    creationBlockers.push({ code: 'ORDER_NOT_PAID' });
  } else if (input.status === OrderStatus.CANCELLED || input.status === OrderStatus.EXPIRED) {
    creationBlockers.push({ code: 'ORDER_CLOSED' });
  } else if (input.status === OrderStatus.SHIPPED || input.status === OrderStatus.DELIVERED) {
    creationBlockers.push({ code: 'ORDER_ALREADY_FULFILLED' });
  }

  if (!input.shipment) {
    creationBlockers.push({ code: 'SHIPPING_NOT_SELECTED' });
  }

  addPlatingBlocker(creationBlockers, platingCheck);

  if (input.shipment) {
    if (input.shipment.providerCreationState === ShipmentProviderCreationState.UNKNOWN) {
      creationBlockers.push({
        code: 'SHIPMENT_PROVIDER_RECONCILIATION_REQUIRED',
      });
    } else if (input.shipment.providerCreationState === ShipmentProviderCreationState.IN_PROGRESS) {
      creationBlockers.push({ code: 'SHIPMENT_CREATION_IN_PROGRESS' });
    } else if (
      input.shipment.providerShipmentId ||
      input.shipment.providerCreationState === ShipmentProviderCreationState.CREATED
    ) {
      creationBlockers.push({ code: 'SHIPMENT_ALREADY_CREATED' });
    } else if (input.shipment.status !== ShipmentStatus.PENDING) {
      creationBlockers.push({ code: 'SHIPMENT_NOT_PENDING' });
    }
  }

  const handoffBlockers: Array<{
    code: FulfillmentHandoffBlockerCode;
  }> = [];

  if (input.status === OrderStatus.PENDING_PAYMENT) {
    handoffBlockers.push({ code: 'ORDER_NOT_PAID' });
  } else if (input.status === OrderStatus.CANCELLED || input.status === OrderStatus.EXPIRED) {
    handoffBlockers.push({ code: 'ORDER_CLOSED' });
  }

  if (!input.shipment) {
    handoffBlockers.push({ code: 'SHIPPING_NOT_SELECTED' });
  }

  addPlatingBlocker(handoffBlockers, platingCheck);

  if (input.shipment) {
    if (!input.shipment.providerShipmentId) {
      handoffBlockers.push({ code: 'PROVIDER_SHIPMENT_NOT_CREATED' });
    } else if (
      !new Set<ShipmentStatus>([
        ShipmentStatus.READY,
        ShipmentStatus.HANDED_OVER,
        ShipmentStatus.IN_TRANSIT,
        ShipmentStatus.DELIVERED,
      ]).has(input.shipment.status)
    ) {
      handoffBlockers.push({ code: 'SHIPMENT_NOT_READY_FOR_HANDOFF' });
    }
  }

  const readyForProcessing =
    (input.status === OrderStatus.PAID || input.status === OrderStatus.PROCESSING) &&
    Boolean(input.shipment);

  const readyForShipmentCreation = creationBlockers.length === 0;
  const readyForHandoff = handoffBlockers.length === 0;

  return {
    orderId: input.id,
    orderNumber: input.orderNumber,
    orderStatus: input.status,
    paidAt: input.paidAt,
    state: (readyForShipmentCreation ? 'READY' : 'BLOCKED') as FulfillmentReadinessState,
    readyForProcessing,
    readyForShipmentCreation,
    readyForHandoff,
    blockers: creationBlockers,
    handoffBlockers,
    checks: {
      payment: paymentCheck,
      plating: platingCheck,
      shippingSelection: shippingSelectionCheck,
      providerCreation: providerCreationCheck,
    },
    shipment: input.shipment
      ? {
          id: input.shipment.id,
          status: input.shipment.status,
          provider: input.shipment.provider,
          providerCreationState: input.shipment.providerCreationState,
          providerShipmentId: input.shipment.providerShipmentId,
          providerCreateError: input.shipment.providerCreateError,
          creationAttemptedAt: input.shipment.creationAttemptedAt,
        }
      : null,
  };
}

function resolvePlatingCheck(
  input: FulfillmentReadinessInput,
): 'NOT_REQUIRED' | 'PENDING' | 'IN_PROGRESS' | 'READY' | 'CANCELLED' {
  if (input.platingTotalToman <= 0) {
    return 'NOT_REQUIRED';
  }

  switch (input.platingFulfillment?.status) {
    case PlatingFulfillmentStatus.COMPLETED:
      return 'READY';
    case PlatingFulfillmentStatus.IN_PROGRESS:
      return 'IN_PROGRESS';
    case PlatingFulfillmentStatus.CANCELLED:
      return 'CANCELLED';
    case PlatingFulfillmentStatus.PENDING:
    case undefined:
      return 'PENDING';
  }
}

function resolveProviderCreationCheck(
  input: FulfillmentReadinessInput,
): 'NOT_SELECTED' | 'NOT_STARTED' | 'IN_PROGRESS' | 'RECONCILIATION_REQUIRED' | 'CREATED' {
  if (!input.shipment) {
    return 'NOT_SELECTED';
  }

  if (input.shipment.providerShipmentId) {
    return 'CREATED';
  }

  switch (input.shipment.providerCreationState) {
    case ShipmentProviderCreationState.NOT_STARTED:
      return 'NOT_STARTED';
    case ShipmentProviderCreationState.IN_PROGRESS:
      return 'IN_PROGRESS';
    case ShipmentProviderCreationState.UNKNOWN:
      return 'RECONCILIATION_REQUIRED';
    case ShipmentProviderCreationState.CREATED:
      return 'RECONCILIATION_REQUIRED';
  }
}

function addPlatingBlocker(
  blockers: Array<{
    code: FulfillmentReadinessBlockerCode | FulfillmentHandoffBlockerCode;
  }>,
  platingCheck: 'NOT_REQUIRED' | 'PENDING' | 'IN_PROGRESS' | 'READY' | 'CANCELLED',
) {
  switch (platingCheck) {
    case 'PENDING':
      blockers.push({ code: 'PLATING_NOT_STARTED' });
      break;
    case 'IN_PROGRESS':
      blockers.push({ code: 'PLATING_IN_PROGRESS' });
      break;
    case 'CANCELLED':
      blockers.push({ code: 'PLATING_CANCELLED' });
      break;
    case 'NOT_REQUIRED':
    case 'READY':
      break;
  }
}
