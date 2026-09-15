import { describe, expect, it } from 'vitest';

import { parseStockNotificationSummary } from '@/lib/inventory-alerts/inventory-alerts-model';

describe('stock notification summary parser', () => {
  it('parses product and variant demand counters', () => {
    expect(
      parseStockNotificationSummary({
        totals: { active: 3, queued: 1, notified: 5, cancelled: 2 },
        targets: [
          {
            productId: 'product-1',
            variantId: 'variant-1',
            activeCount: 3,
            queuedCount: 1,
            notifiedCount: 5,
            cancelledCount: 2,
            lastRequestedAt: '2026-09-07T10:00:00.000Z',
            lastNotifiedAt: null,
            product: {
              id: 'product-1',
              name: 'انگشتر آذر',
              slug: 'azar-ring',
              status: 'ACTIVE',
            },
            variant: {
              id: 'variant-1',
              sku: 'RING-52',
              name: null,
              isActive: true,
              size: { label: '۵۲' },
            },
          },
        ],
      }),
    ).toEqual({
      totals: { active: 3, queued: 1, notified: 5, cancelled: 2 },
      targets: [
        expect.objectContaining({
          id: 'product-1:variant-1',
          productName: 'انگشتر آذر',
          sku: 'RING-52',
          sizeLabel: '۵۲',
          activeCount: 3,
        }),
      ],
    });
  });

  it('rejects malformed counters and incomplete targets', () => {
    expect(
      parseStockNotificationSummary({
        totals: { active: -1, queued: 0, notified: 0, cancelled: 0 },
        targets: [],
      }),
    ).toBeNull();
  });
});
