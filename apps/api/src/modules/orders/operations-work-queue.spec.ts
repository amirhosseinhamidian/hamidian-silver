import {
  OrderStatus,
  PlatingFulfillmentStatus,
  ShipmentProviderCreationState,
  ShipmentStatus,
} from '../../generated/prisma/enums';
import {
  buildOperationsWorkItems,
  summarizeOperationsWorkItems,
  type OperationsWorkQueueInput,
} from './operations-work-queue';

describe('operations work queue derivation', () => {
  const now = new Date('2026-08-30T12:00:00.000Z');

  function baseInput(): OperationsWorkQueueInput {
    return {
      id: '10000000-0000-4000-8000-000000000001',
      orderNumber: 'HS-050',
      status: OrderStatus.PROCESSING,
      paidAt: new Date('2026-08-28T12:00:00.000Z'),
      platingTotalToman: 0,
      items: [],
      platingFulfillment: null,
      shipment: {
        id: '20000000-0000-4000-8000-000000000001',
        status: ShipmentStatus.PENDING,
        provider: 'postex',
        providerCreationState: ShipmentProviderCreationState.NOT_STARTED,
        providerShipmentId: null,
        providerCreateError: null,
        creationAttemptedAt: null,
      },
    };
  }

  it('uses the maximum snapshotted plating lead time for a not-started SLA', () => {
    const input = baseInput();
    input.platingTotalToman = 300_000;
    input.items = [{ platingLeadTimeDays: 2 }, { platingLeadTimeDays: 3 }];

    const items = buildOperationsWorkItems(input, now);

    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          workType: 'PLATING',
          code: 'PLATING_NOT_STARTED',
          state: 'BLOCKED',
          dueAt: new Date('2026-08-31T12:00:00.000Z'),
          overdue: false,
          context: expect.objectContaining({
            maxLeadTimeDays: 3,
          }),
        }),
      ]),
    );
  });

  it('marks in-progress plating overdue from startedAt plus snapshotted lead time', () => {
    const input = baseInput();
    input.platingTotalToman = 300_000;
    input.items = [{ platingLeadTimeDays: 2 }];
    input.platingFulfillment = {
      status: PlatingFulfillmentStatus.IN_PROGRESS,
      startedAt: new Date('2026-08-27T10:00:00.000Z'),
    };

    const items = buildOperationsWorkItems(input, now);

    expect(items[0]).toEqual(
      expect.objectContaining({
        code: 'PLATING_OVERDUE',
        state: 'OVERDUE',
        priority: 'HIGH',
        dueAt: new Date('2026-08-29T10:00:00.000Z'),
        overdue: true,
        context: expect.objectContaining({
          phase: 'IN_PROGRESS',
        }),
      }),
    );
  });

  it('marks a provider creation attempt stale after the shared fifteen-minute window', () => {
    const input = baseInput();
    input.shipment = {
      ...input.shipment!,
      providerCreationState: ShipmentProviderCreationState.IN_PROGRESS,
      creationAttemptedAt: new Date('2026-08-30T11:40:00.000Z'),
    };

    const items = buildOperationsWorkItems(input, now);

    expect(items).toEqual([
      expect.objectContaining({
        workType: 'SHIPPING',
        code: 'SHIPMENT_CREATION_STALE',
        state: 'OVERDUE',
        dueAt: new Date('2026-08-30T11:55:00.000Z'),
        ageMinutes: 20,
      }),
    ]);
  });

  it('surfaces ready-for-handoff after provider creation and plating completion', () => {
    const input = baseInput();
    input.platingTotalToman = 300_000;
    input.items = [{ platingLeadTimeDays: 2 }];
    input.platingFulfillment = {
      status: PlatingFulfillmentStatus.COMPLETED,
      startedAt: new Date('2026-08-28T14:00:00.000Z'),
    };
    input.shipment = {
      ...input.shipment!,
      status: ShipmentStatus.READY,
      providerCreationState: ShipmentProviderCreationState.CREATED,
      providerShipmentId: 'PX-050',
      creationAttemptedAt: new Date('2026-08-30T11:30:00.000Z'),
    };

    const items = buildOperationsWorkItems(input, now);

    expect(items).toEqual([
      expect.objectContaining({
        code: 'READY_FOR_HANDOFF',
        state: 'READY',
        priority: 'MEDIUM',
      }),
    ]);
  });

  it('summarizes work items without double-counting unique orders', () => {
    const input = baseInput();
    input.platingTotalToman = 300_000;
    input.items = [{ platingLeadTimeDays: 5 }];

    const items = buildOperationsWorkItems(input, now);
    const summary = summarizeOperationsWorkItems(items);

    expect(summary.total).toBe(1);
    expect(summary.uniqueOrderCount).toBe(1);
    expect(summary.platingPending).toBe(1);
  });
});
