export type NotificationOutboxSource = 'CUSTOMER' | 'OPERATIONAL';
export type NotificationOutboxStatus =
  'PENDING' | 'PROCESSING' | 'DISPATCHING' | 'SENT' | 'FAILED' | 'UNKNOWN';
export type NotificationRecoveryResolution = 'RETRY_APPROVED' | 'MARKED_SENT';

export type NotificationRecovery = Readonly<{
  id: string;
  resolution: NotificationRecoveryResolution;
  note: string;
  unknownReasonSnapshot: string | null;
  resolvedByUserId: string;
  createdAt: string;
}>;

export type NotificationOutboxItem = Readonly<{
  id: string;
  source: NotificationOutboxSource;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  recipientPhone: string | null;
  priority: string | null;
  level: string | null;
  status: NotificationOutboxStatus;
  attempts: number;
  nextAttemptAt: string;
  claimedAt: string | null;
  processedAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  recoveries: readonly NotificationRecovery[];
}>;

export type NotificationOutboxSummary = Readonly<{
  total: number;
  pending: number;
  processing: number;
  dispatching: number;
  sent: number;
  failed: number;
  unknown: number;
}>;

export type NotificationOutboxSnapshot = Readonly<{
  items: readonly NotificationOutboxItem[];
  summary: NotificationOutboxSummary;
  generatedAt: string;
}>;

type UnknownRecord = Record<string, unknown>;
const SOURCES = new Set<NotificationOutboxSource>(['CUSTOMER', 'OPERATIONAL']);
const STATUSES = new Set<NotificationOutboxStatus>([
  'PENDING',
  'PROCESSING',
  'DISPATCHING',
  'SENT',
  'FAILED',
  'UNKNOWN',
]);
const RESOLUTIONS = new Set<NotificationRecoveryResolution>(['RETRY_APPROVED', 'MARKED_SENT']);

function record(value: unknown): UnknownRecord | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}
function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}
function nullableText(value: unknown): string | null | undefined {
  return value === null ? null : typeof value === 'string' ? value : undefined;
}
function date(value: unknown): string | null {
  const candidate = text(value);
  return candidate && !Number.isNaN(Date.parse(candidate)) ? candidate : null;
}
function nullableDate(value: unknown): string | null | undefined {
  return value === null ? null : (date(value) ?? undefined);
}
function nonnegative(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
}

function recovery(value: unknown): NotificationRecovery | null {
  const source = record(value);
  const id = text(source?.id);
  const resolution = text(source?.resolution);
  const note = text(source?.note);
  const reason = nullableText(source?.unknownReasonSnapshot);
  const actor = text(source?.resolvedByUserId);
  const createdAt = date(source?.createdAt);
  if (
    !source ||
    !id ||
    !resolution ||
    !RESOLUTIONS.has(resolution as NotificationRecoveryResolution) ||
    !note ||
    reason === undefined ||
    !actor ||
    !createdAt
  )
    return null;
  return {
    id,
    resolution: resolution as NotificationRecoveryResolution,
    note,
    unknownReasonSnapshot: reason,
    resolvedByUserId: actor,
    createdAt,
  };
}

function item(value: unknown): NotificationOutboxItem | null {
  const source = record(value);
  const id = text(source?.id);
  const channel = text(source?.source);
  const status = text(source?.status);
  const eventType = text(source?.eventType);
  const aggregateType = text(source?.aggregateType);
  const aggregateId = text(source?.aggregateId);
  const recipientPhone = nullableText(source?.recipientPhone);
  const priority = nullableText(source?.priority);
  const level = nullableText(source?.level);
  const attempts = nonnegative(source?.attempts);
  const nextAttemptAt = date(source?.nextAttemptAt);
  const claimedAt = nullableDate(source?.claimedAt);
  const processedAt = nullableDate(source?.processedAt);
  const lastError = nullableText(source?.lastError);
  const createdAt = date(source?.createdAt);
  const updatedAt = date(source?.updatedAt);
  const recoveries = Array.isArray(source?.recoveries) ? source.recoveries.map(recovery) : null;
  if (
    !source ||
    !id ||
    !channel ||
    !SOURCES.has(channel as NotificationOutboxSource) ||
    !status ||
    !STATUSES.has(status as NotificationOutboxStatus) ||
    !eventType ||
    !aggregateType ||
    !aggregateId ||
    recipientPhone === undefined ||
    priority === undefined ||
    level === undefined ||
    attempts === null ||
    !nextAttemptAt ||
    claimedAt === undefined ||
    processedAt === undefined ||
    lastError === undefined ||
    !createdAt ||
    !updatedAt ||
    !recoveries ||
    recoveries.some((entry) => !entry)
  )
    return null;
  return {
    id,
    source: channel as NotificationOutboxSource,
    eventType,
    aggregateType,
    aggregateId,
    recipientPhone,
    priority,
    level,
    status: status as NotificationOutboxStatus,
    attempts,
    nextAttemptAt,
    claimedAt,
    processedAt,
    lastError,
    createdAt,
    updatedAt,
    recoveries: recoveries as NotificationRecovery[],
  };
}

export function parseNotificationOutboxSnapshot(value: unknown): NotificationOutboxSnapshot | null {
  const source = record(value);
  const summary = record(source?.summary);
  const items = Array.isArray(source?.items) ? source.items.map(item) : null;
  const generatedAt = date(source?.generatedAt);
  const counts = summary
    ? ['total', 'pending', 'processing', 'dispatching', 'sent', 'failed', 'unknown'].map((key) =>
        nonnegative(summary[key]),
      )
    : null;
  if (
    !source ||
    !items ||
    items.some((entry) => !entry) ||
    !generatedAt ||
    !counts ||
    counts.some((count) => count === null)
  )
    return null;
  return {
    items: items as NotificationOutboxItem[],
    summary: {
      total: counts[0]!,
      pending: counts[1]!,
      processing: counts[2]!,
      dispatching: counts[3]!,
      sent: counts[4]!,
      failed: counts[5]!,
      unknown: counts[6]!,
    },
    generatedAt,
  };
}
