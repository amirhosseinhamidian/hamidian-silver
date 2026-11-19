import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  FUNNEL_ORDER_EVENTS_KEY,
  FUNNEL_SESSION_KEY,
  setAnalyticsConsent,
} from '@/lib/analytics/analytics-consent';
import type { FunnelEvent, OrderFunnelEvent } from '@/lib/analytics/funnel-contract';
import { trackFunnelEvent } from '@/lib/analytics/funnel-tracker';

const item = { productId: 'silver-ring', variantId: 'variant-52', quantity: 1 };
const now = new Date('2026-11-19T10:00:00Z');

function orderEvents(): FunnelEvent[] {
  return JSON.parse(window.localStorage.getItem(FUNNEL_ORDER_EVENTS_KEY) ?? '[]');
}

describe('funnel tracking', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.setSystemTime(now);
  });

  afterEach(() => {
    setAnalyticsConsent(false);
    vi.useRealTimers();
  });

  it('starts only after opt-in and removes local measurements after withdrawal', async () => {
    const publish = vi.fn();
    const visit = { name: 'view_item' as const, items: [item] };

    expect(await trackFunnelEvent(visit, { publish })).toBe(false);
    expect(window.sessionStorage.getItem(FUNNEL_SESSION_KEY)).toBeNull();
    expect(publish).not.toHaveBeenCalled();

    setAnalyticsConsent(true);
    expect(await trackFunnelEvent(visit, { publish })).toBe(true);
    expect(publish).toHaveBeenCalledOnce();
    expect(window.sessionStorage.getItem(FUNNEL_SESSION_KEY)).not.toBeNull();

    setAnalyticsConsent(false);
    expect(window.sessionStorage.getItem(FUNNEL_SESSION_KEY)).toBeNull();
    expect(window.localStorage.getItem(FUNNEL_ORDER_EVENTS_KEY)).toBeNull();
    expect(await trackFunnelEvent(visit, { publish })).toBe(false);
    expect(publish).toHaveBeenCalledOnce();
  });

  it('records one checkout for the same cart without creating a purchase', async () => {
    setAnalyticsConsent(true);
    const next = { productId: 'silver-chain', variantId: 'variant-1', quantity: 2 };
    await trackFunnelEvent({ name: 'add_to_cart', items: [item] });
    expect(await trackFunnelEvent({ name: 'begin_checkout', items: [item, next] })).toBe(true);
    expect(await trackFunnelEvent({ name: 'begin_checkout', items: [next, item] })).toBe(false);
    expect(orderEvents()).toEqual([]);
  });

  it('deduplicates confirmed order and refund events using their own record IDs', async () => {
    setAnalyticsConsent(true);
    const base = { orderId: 'order-1', occurredAt: now.toISOString() };
    const purchase: OrderFunnelEvent = { ...base, name: 'purchase_confirmed', items: [item] };
    const publish = vi.fn();
    expect(
      await Promise.all([
        trackFunnelEvent(purchase, { publish }),
        trackFunnelEvent(purchase, { publish }),
      ]),
    ).toEqual([true, false]);
    expect(publish).toHaveBeenCalledOnce();
    window.sessionStorage.clear();
    expect(await trackFunnelEvent(purchase, { publish })).toBe(false);

    const refund = {
      ...base,
      name: 'refund_adjustment' as const,
      refundId: 'refund-1',
      amountToman: 10_000,
    };
    expect(await trackFunnelEvent(refund)).toBe(true);
    expect(await trackFunnelEvent(refund)).toBe(false);
    expect(await trackFunnelEvent({ ...refund, refundId: 'refund-2' })).toBe(true);
    expect(orderEvents().map(({ name }) => name)).toEqual([
      'purchase_confirmed',
      'refund_adjustment',
      'refund_adjustment',
    ]);
  });

  it('drops extra data and skips order events before consent', async () => {
    setAnalyticsConsent(true);
    const earlier = new Date(now.getTime() - 1_000).toISOString();
    const input = {
      name: 'order_submitted' as const,
      orderId: 'order-1',
      occurredAt: earlier,
      customerEmail: 'buyer@example.com',
      items: [{ ...item, addressLine: 'private' }],
    };
    expect(await trackFunnelEvent(input)).toBe(false);
    expect(await trackFunnelEvent({ ...input, occurredAt: now.toISOString() })).toBe(true);
    expect(orderEvents()[0]).toMatchObject({
      version: 1,
      eventId: 'v1:order_submitted:order-1',
      items: [item],
    });
    expect(JSON.stringify(orderEvents())).not.toMatch(/buyer@example\.com|private/);
  });
});
