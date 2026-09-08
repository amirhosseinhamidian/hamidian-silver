import {
  parseOperationalAlerts,
  type AdminOperationalAlert,
  type AdminOperationalAlertActor,
} from '@/lib/operational-alerts/operational-alerts-model';

export const INCIDENT_ACTIVITY_TYPES = [
  'DETECTED',
  'ACKNOWLEDGED',
  'ASSIGNED',
  'UNASSIGNED',
  'NOTE_ADDED',
  'RESOLVED',
  'REOPENED',
] as const;

export type AdminIncidentActivityType = (typeof INCIDENT_ACTIVITY_TYPES)[number];

export type AdminIncidentActivity = Readonly<{
  id: string;
  type: AdminIncidentActivityType;
  actor: AdminOperationalAlertActor | null;
  note: string | null;
  metadata: Readonly<Record<string, unknown>>;
  createdAt: string;
}>;

export type AdminOperationalIncident = AdminOperationalAlert &
  Readonly<{ activities: readonly AdminIncidentActivity[] }>;

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

function activity(value: unknown): AdminIncidentActivity | null {
  const source = record(value);
  const id = text(source?.id);
  const type = source?.type;
  const createdAt = date(source?.createdAt);
  const activityActor = actor(source?.actor);
  const metadata = record(source?.metadata);
  if (
    !id ||
    typeof type !== 'string' ||
    !INCIDENT_ACTIVITY_TYPES.some((candidate) => candidate === type) ||
    !createdAt ||
    activityActor === undefined ||
    !metadata
  ) {
    return null;
  }
  return {
    id,
    type: type as AdminIncidentActivityType,
    actor: activityActor,
    note: nullableText(source?.note),
    metadata,
    createdAt,
  };
}

export function parseOperationalIncident(value: unknown): AdminOperationalIncident | null {
  const source = record(value);
  const base = parseOperationalAlerts([value])?.[0];
  const rawActivities = source?.activities;
  if (!base || !Array.isArray(rawActivities)) return null;
  const activities = rawActivities.map(activity);
  if (activities.some((item) => item === null)) return null;
  return { ...base, activities: activities as AdminIncidentActivity[] };
}
