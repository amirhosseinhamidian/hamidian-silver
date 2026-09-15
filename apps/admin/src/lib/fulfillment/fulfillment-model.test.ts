import { describe, expect, it } from 'vitest';

import {
  formatFulfillmentAge,
  fulfillmentWorkDestination,
  parseFulfillmentQueue,
  parseFulfillmentSummary,
} from '@/lib/fulfillment/fulfillment-model';

function workItem() {
  return {
    orderId: 'order-1',
    orderNumber: 'HS-2401',
    orderStatus: 'PROCESSING',
    workType: 'SHIPPING',
    code: 'READY_FOR_HANDOFF',
    state: 'READY',
    priority: 'MEDIUM',
    dueAt: null,
    overdue: false,
    ageMinutes: 180,
    context: {
      provider: 'manual',
      providerShipmentId: 'manual:order-1',
    },
  };
}

describe('fulfillment model', () => {
  it('parses the work queue and keeps known operational context', () => {
    const result = parseFulfillmentQueue({
      generatedAt: '2026-09-08T08:00:00.000Z',
      type: null,
      state: null,
      totalMatched: 1,
      count: 1,
      items: [workItem()],
    });
    expect(result).toEqual(
      expect.objectContaining({
        totalMatched: 1,
        items: [
          expect.objectContaining({
            code: 'READY_FOR_HANDOFF',
            context: expect.objectContaining({ providerShipmentId: 'manual:order-1' }),
          }),
        ],
      }),
    );
    expect(fulfillmentWorkDestination(result!.items[0])).toBe('/shipping');
  });

  it('rejects unsupported work codes', () => {
    expect(
      parseFulfillmentQueue({
        generatedAt: '2026-09-08T08:00:00.000Z',
        type: null,
        state: null,
        totalMatched: 1,
        count: 1,
        items: [{ ...workItem(), code: 'UNKNOWN_OPERATION' }],
      }),
    ).toBeNull();
  });

  it('parses the complete server summary', () => {
    expect(
      parseFulfillmentSummary({
        generatedAt: '2026-09-08T08:00:00.000Z',
        total: 8,
        uniqueOrderCount: 6,
        ready: 2,
        blocked: 5,
        overdue: 1,
        reconciliationRequired: 1,
        platingPending: 1,
        platingInProgress: 1,
        platingOverdue: 0,
        platingCancelled: 0,
        shippingNotSelected: 2,
        shipmentReady: 1,
        shipmentInProgress: 1,
        shipmentStale: 0,
        shipmentReadyForHandoff: 1,
      }),
    ).toEqual(expect.objectContaining({ total: 8, blocked: 5, shipmentReadyForHandoff: 1 }));
    expect(formatFulfillmentAge(1_500)).toBe('1 روز');
  });
});
