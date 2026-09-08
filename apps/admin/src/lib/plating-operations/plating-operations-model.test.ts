import { describe, expect, it } from 'vitest';

import {
  getPlatingSla,
  parsePlatingOperations,
} from '@/lib/plating-operations/plating-operations-model';

function payload() {
  return {
    orderId: 'order-1',
    orderNumber: 'HS-2301',
    orderStatus: 'PROCESSING',
    paidAt: '2026-09-01T10:00:00.000Z',
    platingTotalToman: 250_000,
    fulfillmentStatus: 'IN_PROGRESS',
    items: [
      {
        id: 'item-1',
        productNameSnapshot: 'انگشتر آذر',
        variantNameSnapshot: 'سایز ۵۲',
        skuSnapshot: 'RING-52',
        quantity: 1,
        platingType: 'GOLD',
        platingWeightGrams: '4.250',
        platingLeadTimeDays: 3,
      },
    ],
    fulfillment: {
      id: 'fulfillment-1',
      orderId: 'order-1',
      status: 'IN_PROGRESS',
      actualCostToman: null,
      externalReference: null,
      startNote: 'تحویل به کارگاه مرکزی',
      completionNote: null,
      cancellationReason: null,
      startedAt: '2026-09-01T12:00:00.000Z',
      completedAt: null,
      cancelledAt: null,
      createdAt: '2026-09-01T12:00:00.000Z',
      updatedAt: '2026-09-01T12:00:00.000Z',
      startedBy: {
        id: 'user-1',
        phone: '+989121234567',
        firstName: 'مدیر',
        lastName: 'عملیات',
      },
      completedBy: null,
      cancelledBy: null,
    },
  };
}

describe('plating operations model', () => {
  it('parses decimal item weight and operational fulfillment details', () => {
    const result = parsePlatingOperations([payload()]);
    expect(result).toEqual([
      expect.objectContaining({
        orderId: 'order-1',
        platingTotalToman: 250_000,
        fulfillmentStatus: 'IN_PROGRESS',
        items: [expect.objectContaining({ platingWeightGrams: 4.25, leadTimeDays: 3 })],
        fulfillment: expect.objectContaining({ startNote: 'تحویل به کارگاه مرکزی' }),
      }),
    ]);
  });

  it('calculates active and completed SLA from the longest item lead time', () => {
    const order = parsePlatingOperations([payload()])?.[0];
    expect(order).toBeDefined();
    expect(getPlatingSla(order!, new Date('2026-09-05T10:00:00.000Z').getTime())).toEqual(
      expect.objectContaining({ state: 'OVERDUE', leadTimeDays: 3 }),
    );

    const completedPayload = {
      ...payload(),
      fulfillmentStatus: 'COMPLETED',
      fulfillment: {
        ...payload().fulfillment,
        status: 'COMPLETED',
        actualCostToman: 140_000,
        completedAt: '2026-09-03T08:00:00.000Z',
      },
    };
    const completed = parsePlatingOperations([completedPayload])?.[0];
    expect(getPlatingSla(completed!)).toEqual(expect.objectContaining({ state: 'ON_TIME' }));
  });

  it('rejects an unsupported plating type', () => {
    expect(
      parsePlatingOperations([
        { ...payload(), items: [{ ...payload().items[0], platingType: 'SILVER' }] },
      ]),
    ).toBeNull();
  });
});
