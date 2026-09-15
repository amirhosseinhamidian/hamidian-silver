export const OPERATIONAL_ALERT_CODES = [
  'PLATING_OVERDUE',
  'PLATING_CANCELLED',
  'SHIPMENT_CREATION_STALE',
  'SHIPMENT_PROVIDER_RECONCILIATION_REQUIRED',
] as const;

export const OPERATIONAL_ALERT_PRIORITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'NORMAL'] as const;
export const OPERATIONAL_ALERT_WORKFLOW_STATUSES = ['OPEN', 'ACKNOWLEDGED', 'RESOLVED'] as const;

export type AdminOperationalAlertCode = (typeof OPERATIONAL_ALERT_CODES)[number];
export type AdminOperationalAlertPriority = (typeof OPERATIONAL_ALERT_PRIORITIES)[number];
export type AdminOperationalAlertWorkflowStatus =
  (typeof OPERATIONAL_ALERT_WORKFLOW_STATUSES)[number];

export type AdminOperationalAlertActor = Readonly<{
  id: string;
  phone: string;
  firstName: string | null;
  lastName: string | null;
}>;

export type AdminOperationalAlert = Readonly<{
  id: string;
  incidentFingerprint: string;
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  code: AdminOperationalAlertCode;
  priority: AdminOperationalAlertPriority;
  incidentAt: string;
  dueAt: string | null;
  firstDetectedAt: string;
  lastDetectedAt: string;
  acknowledgedAt: string | null;
  acknowledgedBy: AdminOperationalAlertActor | null;
  assignedTo: AdminOperationalAlertActor | null;
  resolvedAt: string | null;
  resolutionSource: string | null;
  resolutionNote: string | null;
  workflowStatus: AdminOperationalAlertWorkflowStatus;
  snapshot: Readonly<{
    workType: string | null;
    state: string | null;
    ageMinutes: number | null;
  }>;
  createdAt: string;
  updatedAt: string;
}>;

export type AdminOperationalAlertSummary = Readonly<{
  generatedAt: string;
  activeIncidentCount: number;
  critical: number;
  overdue: number;
  reconciliationRequired: number;
  byCode: Readonly<Record<string, number>>;
  delivery: Readonly<{
    pending: number;
    processing: number;
    sent: number;
    failed: number;
    lastEnqueuedAt: string | null;
    lastProcessedAt: string | null;
  }>;
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

function date(value: unknown): string | null {
  const candidate = text(value);
  return candidate && !Number.isNaN(Date.parse(candidate)) ? candidate : null;
}

function nullableDate(value: unknown): string | null {
  return value === null || value === undefined ? null : date(value);
}

function nonNegativeInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
}

function includes<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && values.some((candidate) => candidate === value);
}

function actor(value: unknown): AdminOperationalAlertActor | null | undefined {
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

function parseAlert(value: unknown): AdminOperationalAlert | null {
  const source = record(value);
  const order = record(source?.order);
  const snapshot = record(source?.snapshot);
  const acknowledgedBy = actor(source?.acknowledgedBy);
  const assignedTo = actor(source?.assignedTo);
  const id = text(source?.id);
  const fingerprint = text(source?.incidentFingerprint);
  const orderId = text(source?.orderId);
  const orderNumber = text(order?.orderNumber);
  const orderStatus = text(order?.status);
  const code = source?.code;
  const priority = source?.priority;
  const workflowStatus = source?.workflowStatus;
  const incidentAt = date(source?.incidentAt);
  const firstDetectedAt = date(source?.firstDetectedAt);
  const lastDetectedAt = date(source?.lastDetectedAt);
  const createdAt = date(source?.createdAt);
  const updatedAt = date(source?.updatedAt);
  const rawAge = snapshot?.ageMinutes;
  const ageMinutes = rawAge === null || rawAge === undefined ? null : nonNegativeInteger(rawAge);
  if (
    !id ||
    !fingerprint ||
    !orderId ||
    !orderNumber ||
    !orderStatus ||
    !includes(OPERATIONAL_ALERT_CODES, code) ||
    !includes(OPERATIONAL_ALERT_PRIORITIES, priority) ||
    !includes(OPERATIONAL_ALERT_WORKFLOW_STATUSES, workflowStatus) ||
    !incidentAt ||
    !firstDetectedAt ||
    !lastDetectedAt ||
    !createdAt ||
    !updatedAt ||
    acknowledgedBy === undefined ||
    assignedTo === undefined ||
    (ageMinutes === null && rawAge !== null && rawAge !== undefined)
  ) {
    return null;
  }
  return {
    id,
    incidentFingerprint: fingerprint,
    orderId,
    orderNumber,
    orderStatus,
    code,
    priority,
    incidentAt,
    dueAt: nullableDate(source?.dueAt),
    firstDetectedAt,
    lastDetectedAt,
    acknowledgedAt: nullableDate(source?.acknowledgedAt),
    acknowledgedBy,
    assignedTo,
    resolvedAt: nullableDate(source?.resolvedAt),
    resolutionSource: nullableText(source?.resolutionSource),
    resolutionNote: nullableText(source?.resolutionNote),
    workflowStatus,
    snapshot: {
      workType: nullableText(snapshot?.workType),
      state: nullableText(snapshot?.state),
      ageMinutes,
    },
    createdAt,
    updatedAt,
  };
}

export function parseOperationalAlerts(value: unknown): readonly AdminOperationalAlert[] | null {
  if (!Array.isArray(value)) return null;
  const alerts = value.map(parseAlert);
  return alerts.some((alert) => alert === null) ? null : (alerts as AdminOperationalAlert[]);
}

function countMap(value: unknown): Readonly<Record<string, number>> | null {
  const source = record(value);
  if (!source) return null;
  const entries = Object.entries(source);
  if (entries.some(([key, count]) => !key.trim() || nonNegativeInteger(count) === null))
    return null;
  return Object.fromEntries(entries) as Record<string, number>;
}

export function parseOperationalAlertSummary(value: unknown): AdminOperationalAlertSummary | null {
  const source = record(value);
  const delivery = record(source?.delivery);
  const generatedAt = date(source?.generatedAt);
  const activeIncidentCount = nonNegativeInteger(source?.activeIncidentCount);
  const critical = nonNegativeInteger(source?.critical);
  const overdue = nonNegativeInteger(source?.overdue);
  const reconciliationRequired = nonNegativeInteger(source?.reconciliationRequired);
  const byCode = countMap(source?.byCode);
  const pending = nonNegativeInteger(delivery?.pending);
  const processing = nonNegativeInteger(delivery?.processing);
  const sent = nonNegativeInteger(delivery?.sent);
  const failed = nonNegativeInteger(delivery?.failed);
  if (
    !generatedAt ||
    activeIncidentCount === null ||
    critical === null ||
    overdue === null ||
    reconciliationRequired === null ||
    !byCode ||
    pending === null ||
    processing === null ||
    sent === null ||
    failed === null
  ) {
    return null;
  }
  return {
    generatedAt,
    activeIncidentCount,
    critical,
    overdue,
    reconciliationRequired,
    byCode,
    delivery: {
      pending,
      processing,
      sent,
      failed,
      lastEnqueuedAt: nullableDate(delivery?.lastEnqueuedAt),
      lastProcessedAt: nullableDate(delivery?.lastProcessedAt),
    },
  };
}

const ESCALATION_MINUTES: Record<AdminOperationalAlertCode, number> = {
  PLATING_OVERDUE: 24 * 60,
  PLATING_CANCELLED: 24 * 60,
  SHIPMENT_CREATION_STALE: 4 * 60,
  SHIPMENT_PROVIDER_RECONCILIATION_REQUIRED: 4 * 60,
};

export function operationalAlertEscalated(
  alert: AdminOperationalAlert,
  now: string | number | Date,
): boolean {
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const incidentMs = new Date(alert.incidentAt).getTime();
  return nowMs >= incidentMs + ESCALATION_MINUTES[alert.code] * 60_000;
}

export function operationalAlertAgeMinutes(
  alert: AdminOperationalAlert,
  now: string | number | Date,
): number {
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
  return Math.max(0, Math.floor((nowMs - new Date(alert.incidentAt).getTime()) / 60_000));
}
