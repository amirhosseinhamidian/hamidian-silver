export type AuditOutcome = 'SUCCESS' | 'FAILURE';

export type AuditLogItem = Readonly<{
  id: string;
  actor: Readonly<{ id: string; phone: string; name: string | null }>;
  action: string;
  resource: string;
  resourceId: string | null;
  method: string;
  path: string;
  statusCode: number;
  outcome: AuditOutcome;
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;
  durationMs: number;
  metadata: Readonly<Record<string, unknown>> | null;
  createdAt: string;
}>;

export type AuditLogSnapshot = Readonly<{
  items: readonly AuditLogItem[];
  summary: Readonly<{
    total: number;
    succeeded: number;
    failed: number;
    actors: number;
    last24Hours: number;
  }>;
  resources: readonly string[];
  generatedAt: string;
}>;

type UnknownRecord = Record<string, unknown>;
const OUTCOMES = new Set<AuditOutcome>(['SUCCESS', 'FAILURE']);

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

function count(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
}

function parseItem(value: unknown): AuditLogItem | null {
  const source = record(value);
  const actor = record(source?.actor);
  const id = text(source?.id);
  const actorId = text(actor?.id);
  const actorPhone = text(actor?.phone);
  const actorName = nullableText(actor?.name);
  const action = text(source?.action);
  const resource = text(source?.resource);
  const resourceId = nullableText(source?.resourceId);
  const method = text(source?.method);
  const path = text(source?.path);
  const statusCode = count(source?.statusCode);
  const outcome = text(source?.outcome);
  const ipAddress = nullableText(source?.ipAddress);
  const userAgent = nullableText(source?.userAgent);
  const requestId = nullableText(source?.requestId);
  const durationMs = count(source?.durationMs);
  const metadata =
    source && 'metadata' in source
      ? source.metadata === null
        ? null
        : record(source.metadata)
      : undefined;
  const createdAt = date(source?.createdAt);
  if (
    !source ||
    !id ||
    !actorId ||
    !actorPhone ||
    actorName === undefined ||
    !action ||
    !resource ||
    resourceId === undefined ||
    !method ||
    !path ||
    statusCode === null ||
    !outcome ||
    !OUTCOMES.has(outcome as AuditOutcome) ||
    ipAddress === undefined ||
    userAgent === undefined ||
    requestId === undefined ||
    durationMs === null ||
    metadata === undefined ||
    !createdAt
  )
    return null;

  return {
    id,
    actor: { id: actorId, phone: actorPhone, name: actorName },
    action,
    resource,
    resourceId,
    method,
    path,
    statusCode,
    outcome: outcome as AuditOutcome,
    ipAddress,
    userAgent,
    requestId,
    durationMs,
    metadata,
    createdAt,
  };
}

export function parseAuditLogSnapshot(value: unknown): AuditLogSnapshot | null {
  const source = record(value);
  const summary = record(source?.summary);
  const items = Array.isArray(source?.items) ? source.items.map(parseItem) : null;
  const resources = Array.isArray(source?.resources) ? source.resources.map(text) : null;
  const generatedAt = date(source?.generatedAt);
  const counts = summary
    ? ['total', 'succeeded', 'failed', 'actors', 'last24Hours'].map((key) => count(summary[key]))
    : null;
  if (
    !source ||
    !items ||
    items.some((item) => !item) ||
    !resources ||
    resources.some((resource) => !resource) ||
    !generatedAt ||
    !counts ||
    counts.some((value) => value === null)
  )
    return null;

  return {
    items: items as AuditLogItem[],
    summary: {
      total: counts[0]!,
      succeeded: counts[1]!,
      failed: counts[2]!,
      actors: counts[3]!,
      last24Hours: counts[4]!,
    },
    resources: resources as string[],
    generatedAt,
  };
}
