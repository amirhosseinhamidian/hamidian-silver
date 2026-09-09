import { describe, expect, it } from 'vitest';

import { parseNotificationOutboxSnapshot } from './notification-outbox-model';

const snapshot = {
  items: [
    {
      id: '10000000-0000-4000-8000-000000000001',
      source: 'CUSTOMER',
      eventType: 'ORDER_SHIPPED',
      aggregateType: 'ORDER',
      aggregateId: '20000000-0000-4000-8000-000000000001',
      recipientPhone: null,
      priority: null,
      level: null,
      status: 'FAILED',
      attempts: 4,
      nextAttemptAt: '2026-09-09T08:00:00.000Z',
      claimedAt: null,
      processedAt: null,
      lastError: 'Provider rejected the request.',
      createdAt: '2026-09-09T07:00:00.000Z',
      updatedAt: '2026-09-09T08:00:00.000Z',
      recoveries: [],
    },
  ],
  summary: { total: 1, pending: 0, processing: 0, dispatching: 0, sent: 0, failed: 1, unknown: 0 },
  generatedAt: '2026-09-09T08:05:00.000Z',
};

describe('notification outbox model', () => {
  it('parses a valid management snapshot', () => {
    expect(parseNotificationOutboxSnapshot(snapshot)).toEqual(snapshot);
  });

  it('rejects unknown lifecycle statuses', () => {
    expect(
      parseNotificationOutboxSnapshot({
        ...snapshot,
        items: [{ ...snapshot.items[0], status: 'RETRYING' }],
      }),
    ).toBeNull();
  });

  it('rejects negative attempt counts', () => {
    expect(
      parseNotificationOutboxSnapshot({
        ...snapshot,
        items: [{ ...snapshot.items[0], attempts: -1 }],
      }),
    ).toBeNull();
  });
});
