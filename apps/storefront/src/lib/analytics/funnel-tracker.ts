'use client';

import {
  analyticsConsentSince,
  FUNNEL_ORDER_EVENTS_KEY,
  FUNNEL_SESSION_KEY,
} from '@/lib/analytics/analytics-consent';
import {
  FUNNEL_EVENT_VERSION,
  projectFunnelEvent,
  type FunnelEvent,
  type FunnelEventInput,
} from '@/lib/analytics/funnel-contract';
import { sendGrowthMeasurement } from '@/lib/analytics/growth-measurement';

const SESSION_IDLE_MS = 30 * 60_000;
const ORDER_EVENT_RETENTION_MS = 90 * 24 * 60 * 60_000;
const MAX_SESSION_EVENTS = 200;
const MAX_ORDER_EVENTS = 500;
const ORDER_EVENT_LOCK = 'hamidian-funnel-orders-v1';
const LEGACY_PURCHASE_KEY = 'hamidian-analytics-purchase-v1:';
const CAMPAIGN_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Session = { id: string; lastActivity: number; events: FunnelEvent[] };
type TrackOptions = Readonly<{ campaignId?: string; publish?: () => void }>;

function readSession(now: number): Session {
  const saved: Session | null = JSON.parse(
    window.sessionStorage.getItem(FUNNEL_SESSION_KEY) ?? 'null',
  );
  if (
    saved &&
    typeof saved.id === 'string' &&
    Number.isFinite(saved.lastActivity) &&
    now - saved.lastActivity < SESSION_IDLE_MS &&
    Array.isArray(saved.events)
  ) {
    return saved;
  }
  return { id: window.crypto.randomUUID(), lastActivity: now, events: [] };
}

function eventId(input: FunnelEventInput, sessionId: string): string {
  if ('orderId' in input) {
    const recordId = input.name === 'refund_adjustment' ? input.refundId : input.orderId;
    return `v${FUNNEL_EVENT_VERSION}:${input.name}:${recordId}`;
  }
  if (input.name === 'select_item' || input.name === 'add_to_cart') {
    return `v${FUNNEL_EVENT_VERSION}:${input.name}:${window.crypto.randomUUID()}`;
  }
  const items = input.items.map(({ productId, variantId, quantity }) =>
    JSON.stringify([productId, variantId, quantity]),
  );
  if (input.name === 'begin_checkout') items.sort();
  const list = 'list' in input ? input.list : '';
  return `v${FUNNEL_EVENT_VERSION}:${sessionId}:${input.name}:${list}:${items.join(',')}`;
}

function storeEvent(input: FunnelEventInput, options: TrackOptions): boolean {
  const consentSince = analyticsConsentSince();
  if (consentSince === null) return false;

  const now = Date.now();
  const orderEvent = 'orderId' in input;
  const occurredAt = orderEvent ? input.occurredAt : new Date(now).toISOString();
  if (
    orderEvent &&
    (Date.parse(occurredAt) < consentSince ||
      Date.parse(occurredAt) < now - ORDER_EVENT_RETENTION_MS)
  ) {
    return false;
  }

  const session = readSession(now);
  const event: FunnelEvent = {
    ...input,
    version: FUNNEL_EVENT_VERSION,
    eventId: eventId(input, session.id),
    sessionId: session.id,
    occurredAt,
    ...(options.campaignId && CAMPAIGN_ID.test(options.campaignId)
      ? { campaignId: options.campaignId }
      : {}),
  };

  if (orderEvent) {
    const saved: FunnelEvent[] = JSON.parse(
      window.localStorage.getItem(FUNNEL_ORDER_EVENTS_KEY) ?? '[]',
    );
    const recent = saved.filter(
      (entry) => Date.parse(entry.occurredAt) >= now - ORDER_EVENT_RETENTION_MS,
    );
    if (recent.some((entry) => entry.eventId === event.eventId)) return false;
    // Save the order key before publishing so a refresh or retry cannot send it again.
    window.localStorage.setItem(
      FUNNEL_ORDER_EVENTS_KEY,
      JSON.stringify([...recent, event].slice(-MAX_ORDER_EVENTS)),
    );
  } else {
    if (session.events.some((entry) => entry.eventId === event.eventId)) return false;
    session.events = [...session.events, event].slice(-MAX_SESSION_EVENTS);
  }

  window.sessionStorage.setItem(
    FUNNEL_SESSION_KEY,
    JSON.stringify({ ...session, lastActivity: now }),
  );
  sendGrowthMeasurement(event);

  if (
    input.name !== 'purchase_confirmed' ||
    window.localStorage.getItem(`${LEGACY_PURCHASE_KEY}${input.orderId}`) !== 'sent'
  ) {
    options.publish?.();
  }
  return true;
}

export async function trackFunnelEvent(input: FunnelEventInput, options: TrackOptions = {}) {
  try {
    if (analyticsConsentSince() === null) return false;
    const projected = projectFunnelEvent(input);
    if (!projected) return false;

    if ('orderId' in projected && window.navigator.locks) {
      return await window.navigator.locks.request(ORDER_EVENT_LOCK, () =>
        storeEvent(projected, options),
      );
    }

    return storeEvent(projected, options);
  } catch {
    // Storage or measurement failures must leave ordering and payment untouched.
    return false;
  }
}
