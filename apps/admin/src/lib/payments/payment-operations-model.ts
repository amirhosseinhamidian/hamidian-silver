export type PaymentOperationsSummary = Readonly<{
  generatedAt: string;
  stuckInitiations: number;
  openReconciliations: number;
  escalatedInitiations: number;
  escalatedReconciliations: number;
  byProvider: Readonly<{
    stuckInitiations: Readonly<Record<string, number>>;
    openReconciliations: Readonly<Record<string, number>>;
  }>;
}>;

export type PaymentInitiationCandidate = Readonly<{
  id: string;
  provider: string;
  amountToman: number;
  createdAt: string;
  updatedAt: string;
  payment: Readonly<{
    id: string;
    status: string;
    amountToman: number;
    order: Readonly<{
      id: string;
      orderNumber: string;
      status: string;
      grandTotalToman: number;
      reservationExpiresAt: string;
    }>;
  }>;
}>;

export type PaymentReconciliation = Readonly<{
  id: string;
  provider: string;
  providerReference: string;
  amountToman: number;
  detectedOrderStatus: string;
  reason: string;
  status: 'OPEN' | 'RESOLVED';
  resolution: string | null;
  externalReference: string | null;
  resolutionNote: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  paymentAttempt: Readonly<{
    id: string;
    provider: string;
    authority: string | null;
    providerReference: string | null;
    amountToman: number;
    status: string;
    verifiedAt: string | null;
    payment: Readonly<{
      id: string;
      status: string;
      amountToman: number;
      order: Readonly<{ id: string; orderNumber: string; status: string }>;
    }>;
  }>;
  resolvedBy: Readonly<{
    id: string;
    phone: string;
    firstName: string | null;
    lastName: string | null;
  }> | null;
}>;

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

function parseCountMap(value: unknown): Readonly<Record<string, number>> | null {
  const source = record(value);
  if (!source) return null;
  const entries = Object.entries(source);
  if (entries.some(([provider, count]) => !provider.trim() || number(count) === null)) return null;
  return Object.fromEntries(entries.map(([provider, count]) => [provider, number(count) ?? 0]));
}

export function parsePaymentOperationsSummary(value: unknown): PaymentOperationsSummary | null {
  const source = record(value);
  const byProvider = record(source?.byProvider);
  const generatedAt = date(source?.generatedAt);
  const stuckInitiations = number(source?.stuckInitiations);
  const openReconciliations = number(source?.openReconciliations);
  const escalatedInitiations = number(source?.escalatedInitiations);
  const escalatedReconciliations = number(source?.escalatedReconciliations);
  const stuckByProvider = parseCountMap(byProvider?.stuckInitiations);
  const reconciliationsByProvider = parseCountMap(byProvider?.openReconciliations);
  if (
    !generatedAt ||
    stuckInitiations === null ||
    openReconciliations === null ||
    escalatedInitiations === null ||
    escalatedReconciliations === null ||
    !stuckByProvider ||
    !reconciliationsByProvider
  )
    return null;
  return {
    generatedAt,
    stuckInitiations,
    openReconciliations,
    escalatedInitiations,
    escalatedReconciliations,
    byProvider: {
      stuckInitiations: stuckByProvider,
      openReconciliations: reconciliationsByProvider,
    },
  };
}

function parseInitiationCandidate(value: unknown): PaymentInitiationCandidate | null {
  const source = record(value);
  const payment = record(source?.payment);
  const order = record(payment?.order);
  const id = text(source?.id);
  const provider = text(source?.provider);
  const amountToman = number(source?.amountToman);
  const createdAt = date(source?.createdAt);
  const updatedAt = date(source?.updatedAt);
  const paymentId = text(payment?.id);
  const paymentStatus = text(payment?.status);
  const paymentAmount = number(payment?.amountToman);
  const orderId = text(order?.id);
  const orderNumber = text(order?.orderNumber);
  const orderStatus = text(order?.status);
  const grandTotalToman = number(order?.grandTotalToman);
  const reservationExpiresAt = date(order?.reservationExpiresAt);
  if (
    !id ||
    !provider ||
    amountToman === null ||
    !createdAt ||
    !updatedAt ||
    !paymentId ||
    !paymentStatus ||
    paymentAmount === null ||
    !orderId ||
    !orderNumber ||
    !orderStatus ||
    grandTotalToman === null ||
    !reservationExpiresAt
  )
    return null;
  return {
    id,
    provider,
    amountToman,
    createdAt,
    updatedAt,
    payment: {
      id: paymentId,
      status: paymentStatus,
      amountToman: paymentAmount,
      order: {
        id: orderId,
        orderNumber,
        status: orderStatus,
        grandTotalToman,
        reservationExpiresAt,
      },
    },
  };
}

export function parsePaymentInitiationCandidates(
  value: unknown,
): readonly PaymentInitiationCandidate[] | null {
  if (!Array.isArray(value)) return null;
  const parsed = value.map(parseInitiationCandidate);
  return parsed.some((item) => item === null) ? null : (parsed as PaymentInitiationCandidate[]);
}

function parseReconciliation(value: unknown): PaymentReconciliation | null {
  const source = record(value);
  const attempt = record(source?.paymentAttempt);
  const payment = record(attempt?.payment);
  const order = record(payment?.order);
  const resolvedBy = record(source?.resolvedBy);
  const status = text(source?.status);
  const base = {
    id: text(source?.id),
    provider: text(source?.provider),
    providerReference: text(source?.providerReference),
    amountToman: number(source?.amountToman),
    detectedOrderStatus: text(source?.detectedOrderStatus),
    reason: text(source?.reason),
    createdAt: date(source?.createdAt),
    updatedAt: date(source?.updatedAt),
  };
  const attemptBase = {
    id: text(attempt?.id),
    provider: text(attempt?.provider),
    amountToman: number(attempt?.amountToman),
    status: text(attempt?.status),
  };
  const paymentBase = {
    id: text(payment?.id),
    status: text(payment?.status),
    amountToman: number(payment?.amountToman),
  };
  const orderBase = {
    id: text(order?.id),
    orderNumber: text(order?.orderNumber),
    status: text(order?.status),
  };
  if (
    !base.id ||
    !base.provider ||
    !base.providerReference ||
    base.amountToman === null ||
    !base.detectedOrderStatus ||
    !base.reason ||
    !base.createdAt ||
    !base.updatedAt ||
    (status !== 'OPEN' && status !== 'RESOLVED') ||
    !attemptBase.id ||
    !attemptBase.provider ||
    attemptBase.amountToman === null ||
    !attemptBase.status ||
    !paymentBase.id ||
    !paymentBase.status ||
    paymentBase.amountToman === null ||
    !orderBase.id ||
    !orderBase.orderNumber ||
    !orderBase.status
  )
    return null;
  const actor = resolvedBy
    ? {
        id: text(resolvedBy.id),
        phone: text(resolvedBy.phone),
        firstName: nullableText(resolvedBy.firstName),
        lastName: nullableText(resolvedBy.lastName),
      }
    : null;
  if (actor && (!actor.id || !actor.phone)) return null;
  return {
    ...(base as {
      id: string;
      provider: string;
      providerReference: string;
      amountToman: number;
      detectedOrderStatus: string;
      reason: string;
      createdAt: string;
      updatedAt: string;
    }),
    status,
    resolution: nullableText(source?.resolution),
    externalReference: nullableText(source?.externalReference),
    resolutionNote: nullableText(source?.resolutionNote),
    resolvedAt: nullableDate(source?.resolvedAt),
    paymentAttempt: {
      id: attemptBase.id,
      provider: attemptBase.provider,
      authority: nullableText(attempt?.authority),
      providerReference: nullableText(attempt?.providerReference),
      amountToman: attemptBase.amountToman,
      status: attemptBase.status,
      verifiedAt: nullableDate(attempt?.verifiedAt),
      payment: {
        id: paymentBase.id,
        status: paymentBase.status,
        amountToman: paymentBase.amountToman,
        order: orderBase as { id: string; orderNumber: string; status: string },
      },
    },
    resolvedBy: actor as PaymentReconciliation['resolvedBy'],
  };
}

export function parsePaymentReconciliations(
  value: unknown,
): readonly PaymentReconciliation[] | null {
  if (!Array.isArray(value)) return null;
  const parsed = value.map(parseReconciliation);
  return parsed.some((item) => item === null) ? null : (parsed as PaymentReconciliation[]);
}
