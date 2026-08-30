import { OperationalAlertLevel, OrderStatus } from '../../generated/prisma/enums';
import { buildOperationalAlertCandidates } from './operational-alerts';
import type { OperationsWorkItem } from './operations-work-queue';

describe('operational alert incident derivation', () => {
  const now = new Date('2026-08-30T12:00:00.000Z');

  function workItem(overrides: Partial<OperationsWorkItem> = {}): OperationsWorkItem {
    return {
      orderId: '10000000-0000-4000-8000-000000000001',
      orderNumber: 'HS-051',
      orderStatus: OrderStatus.PROCESSING,
      workType: 'PLATING',
      code: 'PLATING_OVERDUE',
      state: 'OVERDUE',
      priority: 'HIGH',
      dueAt: new Date('2026-08-29T10:00:00.000Z'),
      overdue: true,
      ageMinutes: 2_000,
      context: {},
      ...overrides,
    };
  }

  it('creates one stable initial alert fingerprint for an overdue incident', () => {
    const candidates = buildOperationalAlertCandidates(workItem(), now);

    expect(candidates[0]).toEqual(
      expect.objectContaining({
        level: OperationalAlertLevel.INITIAL,
        incidentFingerprint:
          'PLATING_OVERDUE:10000000-0000-4000-8000-000000000001:2026-08-29T10:00:00.000Z',
      }),
    );
  });

  it('adds a separate escalation candidate after 24 hours of plating overdue', () => {
    const candidates = buildOperationalAlertCandidates(workItem(), now);

    expect(candidates.map((candidate) => candidate.level)).toEqual([
      OperationalAlertLevel.INITIAL,
      OperationalAlertLevel.ESCALATION,
    ]);
  });

  it('uses the provider incident timestamp for reconciliation deduplication', () => {
    const candidates = buildOperationalAlertCandidates(
      workItem({
        workType: 'SHIPPING',
        code: 'SHIPMENT_PROVIDER_RECONCILIATION_REQUIRED',
        state: 'BLOCKED',
        priority: 'CRITICAL',
        dueAt: null,
        overdue: false,
        context: {
          incidentAt: '2026-08-30T06:00:00.000Z',
        },
      }),
      now,
    );

    expect(candidates[0].incidentFingerprint).toBe(
      'SHIPMENT_PROVIDER_RECONCILIATION_REQUIRED:10000000-0000-4000-8000-000000000001:2026-08-30T06:00:00.000Z',
    );
    expect(candidates.map((candidate) => candidate.level)).toEqual([
      OperationalAlertLevel.INITIAL,
      OperationalAlertLevel.ESCALATION,
    ]);
  });
});
