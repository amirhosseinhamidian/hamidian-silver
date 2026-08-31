import { OperationalAlertLevel } from '../../generated/prisma/enums';
import type { OperationsWorkCode, OperationsWorkItem } from './operations-work-queue';

export type OperationalIncidentDescriptor = {
  orderId: string;
  orderNumber: string;
  code: OperationsWorkCode;
  priority: string;
  incidentFingerprint: string;
  incidentAt: Date;
  dueAt: Date | null;
  payload: Record<string, string | number | boolean | null>;
};

export type OperationalAlertCandidate = {
  orderId: string;
  orderNumber: string;
  code: OperationsWorkCode;
  level: OperationalAlertLevel;
  priority: string;
  incidentFingerprint: string;
  dueAt: Date | null;
  payload: Record<string, string | number | boolean | null>;
};

export const OPERATIONAL_ALERT_CODES = [
  'PLATING_OVERDUE',
  'PLATING_CANCELLED',
  'SHIPMENT_CREATION_STALE',
  'SHIPMENT_PROVIDER_RECONCILIATION_REQUIRED',
] as const satisfies readonly OperationsWorkCode[];

const ALERT_CODES = new Set<OperationsWorkCode>(OPERATIONAL_ALERT_CODES);

const ESCALATION_MS: Partial<Record<OperationsWorkCode, number>> = {
  PLATING_OVERDUE: 24 * 60 * 60 * 1000,
  PLATING_CANCELLED: 24 * 60 * 60 * 1000,
  SHIPMENT_CREATION_STALE: 4 * 60 * 60 * 1000,
  SHIPMENT_PROVIDER_RECONCILIATION_REQUIRED: 4 * 60 * 60 * 1000,
};

export function isOperationalAlertItem(item: OperationsWorkItem): boolean {
  return ALERT_CODES.has(item.code);
}

export function buildOperationalIncidentDescriptor(
  item: OperationsWorkItem,
): OperationalIncidentDescriptor | null {
  if (!isOperationalAlertItem(item)) {
    return null;
  }

  const incidentAt = resolveIncidentAt(item);

  if (!incidentAt) {
    return null;
  }

  const incidentFingerprint = [item.code, item.orderId, incidentAt.toISOString()].join(':');

  return {
    orderId: item.orderId,
    orderNumber: item.orderNumber,
    code: item.code,
    priority: item.priority,
    incidentFingerprint,
    incidentAt,
    dueAt: item.dueAt,
    payload: {
      orderNumber: item.orderNumber,
      workType: item.workType,
      code: item.code,
      state: item.state,
      priority: item.priority,
      incidentAt: incidentAt.toISOString(),
      dueAt: item.dueAt?.toISOString() ?? null,
      ageMinutes: item.ageMinutes,
    },
  };
}

export function buildOperationalAlertCandidates(
  item: OperationsWorkItem,
  now = new Date(),
): OperationalAlertCandidate[] {
  const incident = buildOperationalIncidentDescriptor(item);

  if (!incident) {
    return [];
  }

  const candidates: OperationalAlertCandidate[] = [
    {
      orderId: incident.orderId,
      orderNumber: incident.orderNumber,
      code: incident.code,
      level: OperationalAlertLevel.INITIAL,
      priority: incident.priority,
      incidentFingerprint: incident.incidentFingerprint,
      dueAt: incident.dueAt,
      payload: incident.payload,
    },
  ];
  const escalationMs = ESCALATION_MS[incident.code];

  if (escalationMs !== undefined && now.getTime() >= incident.incidentAt.getTime() + escalationMs) {
    candidates.push({
      orderId: incident.orderId,
      orderNumber: incident.orderNumber,
      code: incident.code,
      level: OperationalAlertLevel.ESCALATION,
      priority: incident.priority,
      incidentFingerprint: incident.incidentFingerprint,
      dueAt: incident.dueAt,
      payload: {
        ...incident.payload,
        escalationAfterMinutes: Math.floor(escalationMs / 60_000),
      },
    });
  }

  return candidates;
}

function resolveIncidentAt(item: OperationsWorkItem): Date | null {
  if (item.code === 'PLATING_OVERDUE' || item.code === 'SHIPMENT_CREATION_STALE') {
    return item.dueAt;
  }

  const value = item.context.incidentAt;

  if (typeof value !== 'string') {
    return item.dueAt;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
