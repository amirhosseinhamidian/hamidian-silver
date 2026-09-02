import { OrderStatus, PaymentStatus, PlatingFulfillmentStatus } from '../../generated/prisma/enums';
import { buildOperationsWorkItems, type OperationsWorkQueueInput } from './operations-work-queue';

describe('operations work queue alert anchors', () => {
  it('still supports an operational order with no selected shipment', () => {
    const input: OperationsWorkQueueInput = {
      id: '10000000-0000-4000-8000-000000000001',
      orderNumber: 'HS-051-NO-SHIP',
      status: OrderStatus.PAID,
      paidAt: new Date('2026-08-30T10:00:00.000Z'),
      payment: { status: PaymentStatus.PAID },
      platingTotalToman: 0,
      platingFulfillment: null,
      shipment: null,
      items: [],
    };

    expect(buildOperationsWorkItems(input, new Date('2026-08-30T12:00:00.000Z'))).toEqual([
      expect.objectContaining({
        code: 'SHIPPING_NOT_SELECTED',
      }),
    ]);
  });

  it('anchors a cancelled plating incident to cancelledAt', () => {
    const input: OperationsWorkQueueInput = {
      id: '20000000-0000-4000-8000-000000000001',
      orderNumber: 'HS-051-CANCELLED',
      status: OrderStatus.PROCESSING,
      paidAt: new Date('2026-08-28T10:00:00.000Z'),
      payment: { status: PaymentStatus.PAID },
      platingTotalToman: 200_000,
      platingFulfillment: {
        status: PlatingFulfillmentStatus.CANCELLED,
        startedAt: new Date('2026-08-28T12:00:00.000Z'),
        cancelledAt: new Date('2026-08-29T08:00:00.000Z'),
      },
      shipment: null,
      items: [
        {
          platingLeadTimeDays: 2,
        },
      ],
    };

    const items = buildOperationsWorkItems(input, new Date('2026-08-30T12:00:00.000Z'));
    const plating = items.find(({ workType }) => workType === 'PLATING');

    expect(plating?.context).toEqual(
      expect.objectContaining({
        incidentAt: '2026-08-29T08:00:00.000Z',
      }),
    );
  });
});
