import { describe, expect, it } from 'vitest';

import {
  operationalAlertEscalated,
  parseOperationalAlerts,
  parseOperationalAlertSummary,
} from '@/lib/operational-alerts/operational-alerts-model';

function incident() {
  return {
    id: 'incident-1',
    incidentFingerprint: 'PLATING_OVERDUE:order-1:2026-09-07T08:00:00.000Z',
    orderId: 'order-1',
    code: 'PLATING_OVERDUE',
    priority: 'HIGH',
    incidentAt: '2026-09-07T08:00:00.000Z',
    dueAt: '2026-09-07T08:00:00.000Z',
    firstDetectedAt: '2026-09-07T08:01:00.000Z',
    lastDetectedAt: '2026-09-08T09:00:00.000Z',
    acknowledgedAt: null,
    acknowledgedBy: null,
    assignedTo: null,
    resolvedAt: null,
    resolutionSource: null,
    resolutionNote: null,
    workflowStatus: 'OPEN',
    snapshot: { workType: 'PLATING', state: 'OVERDUE', ageMinutes: 1_500 },
    createdAt: '2026-09-07T08:01:00.000Z',
    updatedAt: '2026-09-08T09:00:00.000Z',
    order: { id: 'order-1', orderNumber: 'HS-2501', status: 'PROCESSING' },
  };
}

describe('operational alerts model', () => {
  it('parses persistent incident workflow and snapshot', () => {
    const result = parseOperationalAlerts([incident()]);
    expect(result).toEqual([
      expect.objectContaining({
        id: 'incident-1',
        orderNumber: 'HS-2501',
        workflowStatus: 'OPEN',
        snapshot: expect.objectContaining({ ageMinutes: 1_500 }),
      }),
    ]);
  });

  it('calculates escalation using the alert-specific threshold', () => {
    const alert = parseOperationalAlerts([incident()])![0];
    expect(operationalAlertEscalated(alert, '2026-09-08T07:59:00.000Z')).toBe(false);
    expect(operationalAlertEscalated(alert, '2026-09-08T08:00:00.000Z')).toBe(true);
  });

  it('parses incident and delivery summary', () => {
    expect(
      parseOperationalAlertSummary({
        generatedAt: '2026-09-08T09:00:00.000Z',
        activeIncidentCount: 4,
        critical: 1,
        overdue: 3,
        reconciliationRequired: 1,
        byCode: { PLATING_OVERDUE: 2, SHIPMENT_CREATION_STALE: 1 },
        delivery: {
          pending: 1,
          processing: 0,
          sent: 8,
          failed: 1,
          lastEnqueuedAt: '2026-09-08T08:58:00.000Z',
          lastProcessedAt: '2026-09-08T08:59:00.000Z',
        },
      }),
    ).toEqual(
      expect.objectContaining({
        activeIncidentCount: 4,
        delivery: expect.objectContaining({ sent: 8, failed: 1 }),
      }),
    );
  });
});
