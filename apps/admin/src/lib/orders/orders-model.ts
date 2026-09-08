export type AdminOrderStatus =
  'PENDING_PAYMENT' | 'PAID' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'EXPIRED';

export type AdminPaymentStatus =
  'PENDING' | 'PAID' | 'PARTIALLY_REFUNDED' | 'CANCELLED' | 'RECONCILIATION_REQUIRED' | 'REFUNDED';

export type AdminPaymentAttemptStatus =
  'CREATED' | 'REDIRECTED' | 'VERIFIED' | 'FAILED' | 'RECONCILIATION_REQUIRED' | 'RECONCILED';

export type AdminShipmentStatus =
  'PENDING' | 'READY' | 'HANDED_OVER' | 'IN_TRANSIT' | 'DELIVERED' | 'FAILED' | 'CANCELLED';

export type AdminShipmentProviderCreationState =
  'NOT_STARTED' | 'IN_PROGRESS' | 'CREATED' | 'UNKNOWN';

export type AdminOrderCustomer = Readonly<{
  id: string;
  name: string | null;
  phone: string;
}>;

export type AdminOrderItem = Readonly<{
  id: string;
  productName: string;
  variantName: string | null;
  sku: string;
  sizeLabel: string | null;
  quantity: number;
  unitSalePriceToman: number;
  unitSupplierPriceToman: number | null;
  supplierName: string | null;
  platingType: 'GOLD' | 'RHODIUM' | null;
  unitPlatingPriceToman: number;
  platingLeadTimeDays: number | null;
  unitWeightGrams: number | null;
  lineTotalToman: number;
}>;

export type AdminOrderAddress = Readonly<{
  recipientName: string;
  phone: string;
  province: string;
  city: string;
  addressLine: string;
  postalCode: string;
}>;

export type AdminPaymentAttempt = Readonly<{
  id: string;
  provider: string;
  status: AdminPaymentAttemptStatus;
  amountToman: number;
  providerReference: string | null;
  failureCode: string | null;
  failureMessage: string | null;
  verifiedAt: string | null;
  createdAt: string;
}>;

export type AdminOrderPayment = Readonly<{
  id: string;
  status: AdminPaymentStatus;
  amountToman: number;
  refundedAmountToman: number;
  paidAt: string | null;
  updatedAt: string;
  attempts: readonly AdminPaymentAttempt[];
}>;

export type AdminOrderShipment = Readonly<{
  id: string;
  provider: string;
  serviceCode: string;
  serviceName: string | null;
  status: AdminShipmentStatus;
  providerCreationState: AdminShipmentProviderCreationState;
  shippingCostToman: number;
  totalWeightGrams: number;
  estimatedDeliveryDays: number | null;
  providerShipmentId: string | null;
  trackingCode: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
  timeline: readonly AdminShipmentTimelineEntry[];
}>;

export type AdminShipmentTimelineEntry = Readonly<{
  id: string;
  fromStatus: AdminShipmentStatus | null;
  toStatus: AdminShipmentStatus;
  reason: string | null;
  actor: string;
  createdAt: string;
}>;

export type AdminOrderTimelineEntry = Readonly<{
  id: string;
  fromStatus: AdminOrderStatus | null;
  toStatus: AdminOrderStatus;
  reason: string | null;
  actor: string;
  createdAt: string;
}>;

export type AdminOrderReturnAuthorization = Readonly<{
  authorizedAt: string;
  reason: string | null;
  actor: string;
}>;

export type AdminOrder = Readonly<{
  id: string;
  orderNumber: string;
  status: AdminOrderStatus;
  merchandiseTotalToman: number;
  platingTotalToman: number;
  discountTotalToman: number;
  shippingTotalToman: number;
  taxTotalToman: number;
  grandTotalToman: number;
  reservationExpiresAt: string;
  paidAt: string | null;
  cancelledAt: string | null;
  deliveredAt: string | null;
  returnAuthorization: AdminOrderReturnAuthorization | null;
  createdAt: string;
  updatedAt: string;
  customer: AdminOrderCustomer;
  address: AdminOrderAddress | null;
  items: readonly AdminOrderItem[];
  payment: AdminOrderPayment | null;
  shipment: AdminOrderShipment | null;
  timeline: readonly AdminOrderTimelineEntry[];
}>;

const ORDER_STATUSES = new Set<AdminOrderStatus>([
  'PENDING_PAYMENT',
  'PAID',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'EXPIRED',
]);
const PAYMENT_STATUSES = new Set<AdminPaymentStatus>([
  'PENDING',
  'PAID',
  'PARTIALLY_REFUNDED',
  'CANCELLED',
  'RECONCILIATION_REQUIRED',
  'REFUNDED',
]);
const ATTEMPT_STATUSES = new Set<AdminPaymentAttemptStatus>([
  'CREATED',
  'REDIRECTED',
  'VERIFIED',
  'FAILED',
  'RECONCILIATION_REQUIRED',
  'RECONCILED',
]);
const SHIPMENT_STATUSES = new Set<AdminShipmentStatus>([
  'PENDING',
  'READY',
  'HANDED_OVER',
  'IN_TRANSIT',
  'DELIVERED',
  'FAILED',
  'CANCELLED',
]);
const SHIPMENT_PROVIDER_CREATION_STATES = new Set<AdminShipmentProviderCreationState>([
  'NOT_STARTED',
  'IN_PROGRESS',
  'CREATED',
  'UNKNOWN',
]);
const PLATING_TYPES = new Set<NonNullable<AdminOrderItem['platingType']>>(['GOLD', 'RHODIUM']);

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

function nullableDate(value: unknown): string | null {
  return value === null || value === undefined ? null : date(value);
}

function actorLabel(value: unknown): string {
  const actor = record(value);
  const name = [text(actor?.firstName), text(actor?.lastName)].filter(Boolean).join(' ');
  return name || text(actor?.phone) || 'سیستم';
}

function parseItem(value: unknown): AdminOrderItem | null {
  const item = record(value);
  if (!item) return null;
  const id = text(item.id);
  const productName = text(item.productNameSnapshot);
  const sku = text(item.skuSnapshot);
  const quantity = number(item.quantity);
  const unitSalePriceToman = number(item.unitSalePriceToman);
  const unitPlatingPriceToman = number(item.unitPlatingPriceToman);
  const lineTotalToman = number(item.lineTotalToman);
  const platingType = text(item.platingType) as AdminOrderItem['platingType'];
  if (
    !id ||
    !productName ||
    !sku ||
    quantity === null ||
    unitSalePriceToman === null ||
    unitPlatingPriceToman === null ||
    lineTotalToman === null ||
    (platingType !== null && !PLATING_TYPES.has(platingType))
  )
    return null;
  return {
    id,
    productName,
    variantName: text(item.variantNameSnapshot),
    sku,
    sizeLabel: text(item.sizeLabelSnapshot),
    quantity,
    unitSalePriceToman,
    unitSupplierPriceToman: number(item.unitSupplierPriceToman),
    supplierName: text(item.supplierNameSnapshot),
    platingType,
    unitPlatingPriceToman,
    platingLeadTimeDays: number(item.platingLeadTimeDays),
    unitWeightGrams: number(item.unitWeightGrams),
    lineTotalToman,
  };
}

function parseAddress(value: unknown): AdminOrderAddress | null {
  const address = record(value);
  if (!address) return null;
  const recipientName = text(address.recipientName);
  const phone = text(address.phone);
  const province = text(address.province);
  const city = text(address.city);
  const addressLine = text(address.addressLine);
  const postalCode = text(address.postalCode);
  if (!recipientName || !phone || !province || !city || !addressLine || !postalCode) return null;
  return { recipientName, phone, province, city, addressLine, postalCode };
}

function parseAttempt(value: unknown): AdminPaymentAttempt | null {
  const attempt = record(value);
  if (!attempt) return null;
  const id = text(attempt.id);
  const provider = text(attempt.provider);
  const status = text(attempt.status) as AdminPaymentAttemptStatus | null;
  const amountToman = number(attempt.amountToman);
  const createdAt = date(attempt.createdAt);
  const verifiedAt = nullableDate(attempt.verifiedAt);
  if (
    !id ||
    !provider ||
    !status ||
    !ATTEMPT_STATUSES.has(status) ||
    amountToman === null ||
    !createdAt ||
    (attempt.verifiedAt != null && !verifiedAt)
  )
    return null;
  return {
    id,
    provider,
    status,
    amountToman,
    providerReference: text(attempt.providerReference),
    failureCode: text(attempt.failureCode),
    failureMessage: text(attempt.failureMessage),
    verifiedAt,
    createdAt,
  };
}

function parsePayment(value: unknown): AdminOrderPayment | null {
  const payment = record(value);
  if (!payment) return null;
  const id = text(payment.id);
  const status = text(payment.status) as AdminPaymentStatus | null;
  const amountToman = number(payment.amountToman);
  const refundedAmountToman = number(payment.refundedAmountToman);
  const paidAt = nullableDate(payment.paidAt);
  const updatedAt = date(payment.updatedAt);
  if (
    !id ||
    !status ||
    !PAYMENT_STATUSES.has(status) ||
    amountToman === null ||
    refundedAmountToman === null ||
    !updatedAt ||
    (payment.paidAt != null && !paidAt) ||
    !Array.isArray(payment.attempts)
  )
    return null;
  const attempts = payment.attempts.map(parseAttempt);
  if (attempts.some((attempt) => !attempt)) return null;
  return {
    id,
    status,
    amountToman,
    refundedAmountToman,
    paidAt,
    updatedAt,
    attempts: attempts as AdminPaymentAttempt[],
  };
}

function parseShipment(value: unknown): AdminOrderShipment | null {
  const shipment = record(value);
  if (!shipment) return null;
  const id = text(shipment.id);
  const provider = text(shipment.provider);
  const serviceCode = text(shipment.providerServiceCode);
  const status = text(shipment.status) as AdminShipmentStatus | null;
  const providerCreationState = text(
    shipment.providerCreationState,
  ) as AdminShipmentProviderCreationState | null;
  const shippingCostToman = number(shipment.shippingCostToman);
  const totalWeightGrams = number(shipment.totalWeightGrams);
  const shippedAt = nullableDate(shipment.shippedAt);
  const deliveredAt = nullableDate(shipment.deliveredAt);
  const createdAt = date(shipment.createdAt);
  const updatedAt = date(shipment.updatedAt);
  if (
    !id ||
    !provider ||
    !serviceCode ||
    !status ||
    !SHIPMENT_STATUSES.has(status) ||
    !providerCreationState ||
    !SHIPMENT_PROVIDER_CREATION_STATES.has(providerCreationState) ||
    shippingCostToman === null ||
    totalWeightGrams === null ||
    !createdAt ||
    !updatedAt ||
    !Array.isArray(shipment.statusHistory) ||
    (shipment.shippedAt != null && !shippedAt) ||
    (shipment.deliveredAt != null && !deliveredAt)
  )
    return null;
  const timeline = shipment.statusHistory.map(parseShipmentTimelineEntry);
  if (timeline.some((entry) => !entry)) return null;
  return {
    id,
    provider,
    serviceCode,
    serviceName: text(shipment.providerServiceName),
    status,
    providerCreationState,
    shippingCostToman,
    totalWeightGrams,
    estimatedDeliveryDays: number(shipment.estimatedDeliveryDays),
    providerShipmentId: text(shipment.providerShipmentId),
    trackingCode: text(shipment.trackingCode),
    shippedAt,
    deliveredAt,
    createdAt,
    updatedAt,
    timeline: timeline as AdminShipmentTimelineEntry[],
  };
}

function parseShipmentTimelineEntry(value: unknown): AdminShipmentTimelineEntry | null {
  const entry = record(value);
  if (!entry) return null;
  const id = text(entry.id);
  const fromStatus = text(entry.fromStatus) as AdminShipmentStatus | null;
  const toStatus = text(entry.toStatus) as AdminShipmentStatus | null;
  const createdAt = date(entry.createdAt);
  if (
    !id ||
    !toStatus ||
    !SHIPMENT_STATUSES.has(toStatus) ||
    (fromStatus !== null && !SHIPMENT_STATUSES.has(fromStatus)) ||
    !createdAt
  )
    return null;
  return {
    id,
    fromStatus,
    toStatus,
    reason: text(entry.reason),
    actor: actorLabel(entry.actor),
    createdAt,
  };
}

function parseTimelineEntry(value: unknown): AdminOrderTimelineEntry | null {
  const entry = record(value);
  if (!entry) return null;
  const id = text(entry.id);
  const fromStatus = text(entry.fromStatus) as AdminOrderStatus | null;
  const toStatus = text(entry.toStatus) as AdminOrderStatus | null;
  const createdAt = date(entry.createdAt);
  if (
    !id ||
    !toStatus ||
    !ORDER_STATUSES.has(toStatus) ||
    (fromStatus !== null && !ORDER_STATUSES.has(fromStatus)) ||
    !createdAt
  )
    return null;
  return {
    id,
    fromStatus,
    toStatus,
    reason: text(entry.reason),
    actor: actorLabel(entry.actor),
    createdAt,
  };
}

function parseOrder(value: unknown): AdminOrder | null {
  const order = record(value);
  if (!order) return null;
  const user = record(order.user);
  if (!user) return null;
  const id = text(order.id);
  const orderNumber = text(order.orderNumber);
  const status = text(order.status) as AdminOrderStatus | null;
  const customerId = text(user.id);
  const customerPhone = text(user.phone);
  const reservationExpiresAt = date(order.reservationExpiresAt);
  const paidAt = nullableDate(order.paidAt);
  const cancelledAt = nullableDate(order.cancelledAt);
  const deliveredAt = nullableDate(order.deliveredAt);
  const returnAuthorizedAt = nullableDate(order.returnAuthorizedAt);
  const createdAt = date(order.createdAt);
  const updatedAt = date(order.updatedAt);
  const merchandiseTotalToman = number(order.merchandiseTotalToman);
  const platingTotalToman = number(order.platingTotalToman);
  const discountTotalToman = number(order.discountTotalToman);
  const shippingTotalToman = number(order.shippingTotalToman);
  const taxTotalToman = number(order.taxTotalToman);
  const grandTotalToman = number(order.grandTotalToman);
  if (
    !id ||
    !orderNumber ||
    !status ||
    !ORDER_STATUSES.has(status) ||
    !customerId ||
    !customerPhone ||
    !reservationExpiresAt ||
    !createdAt ||
    !updatedAt ||
    merchandiseTotalToman === null ||
    platingTotalToman === null ||
    discountTotalToman === null ||
    shippingTotalToman === null ||
    taxTotalToman === null ||
    grandTotalToman === null ||
    (order.paidAt != null && !paidAt) ||
    (order.cancelledAt != null && !cancelledAt) ||
    (order.deliveredAt != null && !deliveredAt) ||
    (order.returnAuthorizedAt != null && !returnAuthorizedAt) ||
    !Array.isArray(order.items) ||
    !Array.isArray(order.statusHistory)
  )
    return null;
  const items = order.items.map(parseItem);
  const timeline = order.statusHistory.map(parseTimelineEntry);
  const address = order.shippingAddress == null ? null : parseAddress(order.shippingAddress);
  const payment = order.payment == null ? null : parsePayment(order.payment);
  const shipment = order.shipment == null ? null : parseShipment(order.shipment);
  if (
    items.some((item) => !item) ||
    timeline.some((entry) => !entry) ||
    (order.shippingAddress != null && !address) ||
    (order.payment != null && !payment) ||
    (order.shipment != null && !shipment)
  )
    return null;
  const customerName =
    [text(user.firstName), text(user.lastName)].filter(Boolean).join(' ') || null;
  return {
    id,
    orderNumber,
    status,
    merchandiseTotalToman,
    platingTotalToman,
    discountTotalToman,
    shippingTotalToman,
    taxTotalToman,
    grandTotalToman,
    reservationExpiresAt,
    paidAt,
    cancelledAt,
    deliveredAt,
    returnAuthorization: returnAuthorizedAt
      ? {
          authorizedAt: returnAuthorizedAt,
          reason: text(order.returnAuthorizationReason),
          actor: actorLabel(order.returnAuthorizedBy),
        }
      : null,
    createdAt,
    updatedAt,
    customer: { id: customerId, name: customerName, phone: customerPhone },
    address,
    items: items as AdminOrderItem[],
    payment,
    shipment,
    timeline: timeline as AdminOrderTimelineEntry[],
  };
}

export function parseAdminOrders(value: unknown): readonly AdminOrder[] | null {
  if (!Array.isArray(value)) return null;
  const orders = value.map(parseOrder);
  return orders.some((order) => !order) ? null : (orders as AdminOrder[]);
}

export function orderItemCount(order: AdminOrder): number {
  return order.items.reduce((total, item) => total + item.quantity, 0);
}

export function orderRequiresAttention(order: AdminOrder): boolean {
  return (
    order.payment?.status === 'RECONCILIATION_REQUIRED' ||
    order.shipment?.status === 'FAILED' ||
    (order.status === 'PAID' && order.payment?.status !== 'PAID')
  );
}
