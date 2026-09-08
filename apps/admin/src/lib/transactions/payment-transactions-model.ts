export const PAYMENT_ATTEMPT_STATUSES = [
  'CREATED',
  'REDIRECTED',
  'VERIFIED',
  'FAILED',
  'RECONCILIATION_REQUIRED',
  'RECONCILED',
] as const;

export type AdminPaymentAttemptStatus = (typeof PAYMENT_ATTEMPT_STATUSES)[number];

export type AdminPaymentActor = Readonly<{
  id: string;
  phone: string;
  firstName: string | null;
  lastName: string | null;
}>;

export type AdminPaymentAttempt = Readonly<{
  id: string;
  provider: string;
  status: AdminPaymentAttemptStatus;
  amountToman: number;
  authority: string | null;
  providerReference: string | null;
  failureCode: string | null;
  failureMessage: string | null;
  verifiedAt: string | null;
  initiationRecoveryResolution: string | null;
  initiationRecoveryNote: string | null;
  initiationRecoveryResolvedAt: string | null;
  initiationRecoveryResolvedBy: AdminPaymentActor | null;
  reconciliation: Readonly<{
    id: string;
    status: string;
    reason: string;
    resolution: string | null;
    externalReference: string | null;
    resolvedAt: string | null;
  }> | null;
  payment: Readonly<{
    id: string;
    status: string;
    amountToman: number;
    refundedAmountToman: number;
    paidAt: string | null;
    order: Readonly<{
      id: string;
      orderNumber: string;
      status: string;
      grandTotalToman: number;
      user: AdminPaymentActor;
    }>;
  }>;
  createdAt: string;
  updatedAt: string;
}>;

export type AdminPaymentAttemptPage = Readonly<{
  items: readonly AdminPaymentAttempt[];
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
  summary: Readonly<{
    totalAmountToman: number;
    byStatus: Readonly<Record<string, number>>;
    byProvider: Readonly<Record<string, number>>;
  }>;
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

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function date(value: unknown): string | null {
  const candidate = text(value);
  return candidate && !Number.isNaN(Date.parse(candidate)) ? candidate : null;
}

function nullableDate(value: unknown): string | null {
  return value === null || value === undefined ? null : date(value);
}

function countMap(value: unknown): Readonly<Record<string, number>> | null {
  const source = record(value);
  if (!source) return null;
  const entries = Object.entries(source);
  if (entries.some(([key, count]) => !key.trim() || finiteNumber(count) === null)) return null;
  return Object.fromEntries(entries.map(([key, count]) => [key, finiteNumber(count) ?? 0]));
}

function actor(value: unknown): AdminPaymentActor | null {
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

function nullableActor(value: unknown): AdminPaymentActor | null | undefined {
  if (value === null || value === undefined) return null;
  return actor(value) ?? undefined;
}

function isAttemptStatus(value: unknown): value is AdminPaymentAttemptStatus {
  return (
    typeof value === 'string' && PAYMENT_ATTEMPT_STATUSES.some((candidate) => candidate === value)
  );
}

function paymentAttempt(value: unknown): AdminPaymentAttempt | null {
  const source = record(value);
  const payment = record(source?.payment);
  const order = record(payment?.order);
  const reconciliation = record(source?.reconciliation);
  const customer = actor(order?.user);
  const recoveryActor = nullableActor(source?.initiationRecoveryResolvedBy);
  const id = text(source?.id);
  const provider = text(source?.provider);
  const amountToman = finiteNumber(source?.amountToman);
  const createdAt = date(source?.createdAt);
  const updatedAt = date(source?.updatedAt);
  const paymentId = text(payment?.id);
  const paymentStatus = text(payment?.status);
  const paymentAmount = finiteNumber(payment?.amountToman);
  const refundedAmount = finiteNumber(payment?.refundedAmountToman);
  const orderId = text(order?.id);
  const orderNumber = text(order?.orderNumber);
  const orderStatus = text(order?.status);
  const grandTotal = finiteNumber(order?.grandTotalToman);

  if (
    !id ||
    !provider ||
    !isAttemptStatus(source?.status) ||
    amountToman === null ||
    !createdAt ||
    !updatedAt ||
    !paymentId ||
    !paymentStatus ||
    paymentAmount === null ||
    refundedAmount === null ||
    !orderId ||
    !orderNumber ||
    !orderStatus ||
    grandTotal === null ||
    !customer ||
    recoveryActor === undefined
  ) {
    return null;
  }

  const parsedReconciliation = reconciliation
    ? {
        id: text(reconciliation.id),
        status: text(reconciliation.status),
        reason: text(reconciliation.reason),
        resolution: nullableText(reconciliation.resolution),
        externalReference: nullableText(reconciliation.externalReference),
        resolvedAt: nullableDate(reconciliation.resolvedAt),
      }
    : null;
  if (
    parsedReconciliation &&
    (!parsedReconciliation.id || !parsedReconciliation.status || !parsedReconciliation.reason)
  ) {
    return null;
  }

  return {
    id,
    provider,
    status: source.status,
    amountToman,
    authority: nullableText(source.authority),
    providerReference: nullableText(source.providerReference),
    failureCode: nullableText(source.failureCode),
    failureMessage: nullableText(source.failureMessage),
    verifiedAt: nullableDate(source.verifiedAt),
    initiationRecoveryResolution: nullableText(source.initiationRecoveryResolution),
    initiationRecoveryNote: nullableText(source.initiationRecoveryNote),
    initiationRecoveryResolvedAt: nullableDate(source.initiationRecoveryResolvedAt),
    initiationRecoveryResolvedBy: recoveryActor,
    reconciliation: parsedReconciliation as AdminPaymentAttempt['reconciliation'],
    payment: {
      id: paymentId,
      status: paymentStatus,
      amountToman: paymentAmount,
      refundedAmountToman: refundedAmount,
      paidAt: nullableDate(payment?.paidAt),
      order: {
        id: orderId,
        orderNumber,
        status: orderStatus,
        grandTotalToman: grandTotal,
        user: customer,
      },
    },
    createdAt,
    updatedAt,
  };
}

export function parsePaymentAttemptPage(value: unknown): AdminPaymentAttemptPage | null {
  const source = record(value);
  const summary = record(source?.summary);
  if (!Array.isArray(source?.items)) return null;
  const items = source.items.map(paymentAttempt);
  const page = finiteNumber(source.page);
  const pageSize = finiteNumber(source.pageSize);
  const total = finiteNumber(source.total);
  const pageCount = finiteNumber(source.pageCount);
  const totalAmountToman = finiteNumber(summary?.totalAmountToman);
  const byStatus = countMap(summary?.byStatus);
  const byProvider = countMap(summary?.byProvider);
  if (
    items.some((item) => item === null) ||
    page === null ||
    pageSize === null ||
    total === null ||
    pageCount === null ||
    totalAmountToman === null ||
    !byStatus ||
    !byProvider
  ) {
    return null;
  }
  return {
    items: items as AdminPaymentAttempt[],
    page,
    pageSize,
    total,
    pageCount,
    summary: { totalAmountToman, byStatus, byProvider },
  };
}

export function paymentAttemptNeedsReview(attempt: AdminPaymentAttempt, now = Date.now()): boolean {
  return (
    attempt.status === 'RECONCILIATION_REQUIRED' ||
    (attempt.status === 'CREATED' && now - new Date(attempt.createdAt).getTime() >= 5 * 60 * 1000)
  );
}
