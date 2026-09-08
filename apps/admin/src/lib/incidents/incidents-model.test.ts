import { describe, expect, it } from 'vitest';

import { parseOperationalIncident } from '@/lib/incidents/incidents-model';

const incident = {
  id: 'incident-1',
  incidentFingerprint: 'PLATING_OVERDUE:order-1:2026-09-07T08:00:00.000Z',
  orderId: 'order-1',
  order: { id: 'order-1', orderNumber: 'HS-2501', status: 'PROCESSING' },
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
  snapshot: { workType: 'PLATING', state: 'OVERDUE', ageMinutes: 1500 },
  createdAt: '2026-09-07T08:01:00.000Z',
  updatedAt: '2026-09-08T09:00:00.000Z',
  activities: [
    {
      id: 'activity-1',
      type: 'DETECTED',
      actor: null,
      note: null,
      metadata: { incidentAt: '2026-09-07T08:00:00.000Z' },
      createdAt: '2026-09-07T08:01:00.000Z',
    },
  ],
};

describe('incident model', () => {
  it('parses a complete incident and its auditable timeline', () => {
    expect(parseOperationalIncident(incident)).toMatchObject({
      id: 'incident-1',
      workflowStatus: 'OPEN',
      activities: [{ type: 'DETECTED', actor: null }],
    });
  });

  it('rejects unknown activity types', () => {
    expect(
      parseOperationalIncident({
        ...incident,
        activities: [{ ...incident.activities[0], type: 'MANUAL_OVERRIDE' }],
      }),
    ).toBeNull();
  });
});
