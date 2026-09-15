export type AdminRefundStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'FAILED';

export type AdminRefundActor = Readonly<{
  id: string;
  phone: string;
  firstName: string | null;
  lastName: string | null;
}>;

export type AdminPaymentRefund = Readonly<{
  id: string;
  paymentId: string;
  idempotencyKey: string;
  status: AdminRefundStatus;
  amountToman: number;
  providerSnapshot: string | null;
  originalProviderReferenceSnapshot: string | null;
  externalReference: string | null;
  requestNote: string | null;
  resolutionNote: string | null;
  confirmedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  payment: Readonly<{
    id: string;
    orderId: string;
    status: string;
    amountToman: number;
    refundedAmountToman: number;
    refundAllocatedToman: number;
    order: Readonly<{
      id: string;
      orderNumber: string;
      status: string;
    }>;
  }>;
  requestedBy: AdminRefundActor | null;
  confirmedBy: AdminRefundActor | null;
  cancelledBy: AdminRefundActor | null;
}>;

export type AdminRefundOrder = Readonly<{
  id: string;
  orderNumber: string;
  status: string;
  customer: Readonly<{
    id: string;
    phone: string;
    firstName: string | null;
    lastName: string | null;
  }>;
  payment: Readonly<{
    status: string;
    amountToman: number;
    refundedAmountToman: number;
    refundAllocatedToman: number;
  }>;
}>;

const REFUND_STATUSES = new Set<AdminRefundStatus>(['PENDING', 'CONFIRMED', 'CANCELLED', 'FAILED']);

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
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

function date(value: unknown): string | null {
  const candidate = text(value);
  return candidate && !Number.isNaN(Date.parse(candidate)) ? candidate : null;
}

function nullableText(value: unknown): string | null {
  return value === null || value === undefined ? null : text(value);
}

function nullableDate(value: unknown): string | null {
  return value === null || value === undefined ? null : date(value);
}

function parseActor(value: unknown): AdminRefundActor | null {
  if (value === null || value === undefined) return null;
  const source = record(value);
  const id = text(source?.id);
  const phone = text(source?.phone);
  if (!id || !phone) return null;
  return {
    id,
    phone,
    firstName: nullableText(source?.firstName),
    lastName: nullableText(source?.lastName),
  };
}

function parseRefund(value: unknown): AdminPaymentRefund | null {
  const source = record(value);
  const payment = record(source?.payment);
  const order = record(payment?.order);
  const status = text(source?.status) as AdminRefundStatus | null;
  const base = {
    id: text(source?.id),
    paymentId: text(source?.paymentId),
    idempotencyKey: text(source?.idempotencyKey),
    amountToman: number(source?.amountToman),
    createdAt: date(source?.createdAt),
    updatedAt: date(source?.updatedAt),
  };
  const paymentBase = {
    id: text(payment?.id),
    orderId: text(payment?.orderId),
    status: text(payment?.status),
    amountToman: number(payment?.amountToman),
    refundedAmountToman: number(payment?.refundedAmountToman),
    refundAllocatedToman: number(payment?.refundAllocatedToman),
  };
  const orderBase = {
    id: text(order?.id),
    orderNumber: text(order?.orderNumber),
    status: text(order?.status),
  };
  if (
    !base.id ||
    !base.paymentId ||
    !base.idempotencyKey ||
    base.amountToman === null ||
    !base.createdAt ||
    !base.updatedAt ||
    !status ||
    !REFUND_STATUSES.has(status) ||
    !paymentBase.id ||
    !paymentBase.orderId ||
    !paymentBase.status ||
    paymentBase.amountToman === null ||
    paymentBase.refundedAmountToman === null ||
    paymentBase.refundAllocatedToman === null ||
    !orderBase.id ||
    !orderBase.orderNumber ||
    !orderBase.status
  ) {
    return null;
  }

  const requestedBy = parseActor(source?.requestedBy);
  const confirmedBy = parseActor(source?.confirmedBy);
  const cancelledBy = parseActor(source?.cancelledBy);
  if (
    (source?.requestedBy != null && !requestedBy) ||
    (source?.confirmedBy != null && !confirmedBy) ||
    (source?.cancelledBy != null && !cancelledBy)
  ) {
    return null;
  }

  return {
    id: base.id,
    paymentId: base.paymentId,
    idempotencyKey: base.idempotencyKey,
    status,
    amountToman: base.amountToman,
    providerSnapshot: nullableText(source?.providerSnapshot),
    originalProviderReferenceSnapshot: nullableText(source?.originalProviderReferenceSnapshot),
    externalReference: nullableText(source?.externalReference),
    requestNote: nullableText(source?.requestNote),
    resolutionNote: nullableText(source?.resolutionNote),
    confirmedAt: nullableDate(source?.confirmedAt),
    cancelledAt: nullableDate(source?.cancelledAt),
    createdAt: base.createdAt,
    updatedAt: base.updatedAt,
    payment: {
      id: paymentBase.id,
      orderId: paymentBase.orderId,
      status: paymentBase.status,
      amountToman: paymentBase.amountToman,
      refundedAmountToman: paymentBase.refundedAmountToman,
      refundAllocatedToman: paymentBase.refundAllocatedToman,
      order: {
        id: orderBase.id,
        orderNumber: orderBase.orderNumber,
        status: orderBase.status,
      },
    },
    requestedBy,
    confirmedBy,
    cancelledBy,
  };
}

export function parsePaymentRefunds(value: unknown): readonly AdminPaymentRefund[] | null {
  if (!Array.isArray(value)) return null;
  const refunds = value.map(parseRefund);
  return refunds.some((refund) => refund === null) ? null : (refunds as AdminPaymentRefund[]);
}

function parseRefundOrder(value: unknown): AdminRefundOrder | null {
  const snapshot = record(value);
  const order = record(snapshot?.order);
  const payment = record(order?.payment);
  const user = record(order?.user);
  const id = text(order?.id);
  const orderNumber = text(order?.orderNumber);
  const status = text(order?.status);
  const userId = text(user?.id);
  const phone = text(user?.phone);
  const paymentStatus = text(payment?.status);
  const amountToman = number(payment?.amountToman);
  const refundedAmountToman = number(payment?.refundedAmountToman);
  const refundAllocatedToman = number(payment?.refundAllocatedToman);
  if (
    !id ||
    !orderNumber ||
    !status ||
    !userId ||
    !phone ||
    !paymentStatus ||
    amountToman === null ||
    refundedAmountToman === null ||
    refundAllocatedToman === null
  ) {
    return null;
  }
  return {
    id,
    orderNumber,
    status,
    customer: {
      id: userId,
      phone,
      firstName: nullableText(user?.firstName),
      lastName: nullableText(user?.lastName),
    },
    payment: {
      status: paymentStatus,
      amountToman,
      refundedAmountToman,
      refundAllocatedToman,
    },
  };
}

export function parseRefundOrders(value: unknown): readonly AdminRefundOrder[] | null {
  if (!Array.isArray(value)) return null;
  const orders = value.map(parseRefundOrder);
  return orders.some((order) => order === null) ? null : (orders as AdminRefundOrder[]);
}
