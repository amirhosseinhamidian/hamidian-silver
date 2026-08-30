import { OperationalAlertLevel } from '../../generated/prisma/enums';
import type { OperationsWorkCode, OperationsWorkItem } from './operations-work-queue';

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

const ALERT_CODES = new Set<OperationsWorkCode>([
  'PLATING_OVERDUE',
  'PLATING_CANCELLED',
  'SHIPMENT_CREATION_STALE',
  'SHIPMENT_PROVIDER_RECONCILIATION_REQUIRED',
]);

const ESCALATION_MS: Partial<Record<OperationsWorkCode, number>> = {
  PLATING_OVERDUE: 24 * 60 * 60 * 1000,
  PLATING_CANCELLED: 24 * 60 * 60 * 1000,
  SHIPMENT_CREATION_STALE: 4 * 60 * 60 * 1000,
  SHIPMENT_PROVIDER_RECONCILIATION_REQUIRED: 4 * 60 * 60 * 1000,
};

export function isOperationalAlertItem(item: OperationsWorkItem): boolean {
  return ALERT_CODES.has(item.code);
}

export function buildOperationalAlertCandidates(
  item: OperationsWorkItem,
  now = new Date(),
): OperationalAlertCandidate[] {
  if (!isOperationalAlertItem(item)) {
    return [];
  }

  const incidentAt = resolveIncidentAt(item);

  if (!incidentAt) {
    return [];
  }

  const fingerprint = [item.code, item.orderId, incidentAt.toISOString()].join(':');
  const payload = {
    orderNumber: item.orderNumber,
    workType: item.workType,
    code: item.code,
    state: item.state,
    priority: item.priority,
    incidentAt: incidentAt.toISOString(),
    dueAt: item.dueAt?.toISOString() ?? null,
    ageMinutes: item.ageMinutes,
  };
  const candidates: OperationalAlertCandidate[] = [
    {
      orderId: item.orderId,
      orderNumber: item.orderNumber,
      code: item.code,
      level: OperationalAlertLevel.INITIAL,
      priority: item.priority,
      incidentFingerprint: fingerprint,
      dueAt: item.dueAt,
      payload,
    },
  ];
  const escalationMs = ESCALATION_MS[item.code];

  if (escalationMs !== undefined && now.getTime() >= incidentAt.getTime() + escalationMs) {
    candidates.push({
      orderId: item.orderId,
      orderNumber: item.orderNumber,
      code: item.code,
      level: OperationalAlertLevel.ESCALATION,
      priority: item.priority,
      incidentFingerprint: fingerprint,
      dueAt: item.dueAt,
      payload: {
        ...payload,
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
