import { analyticsConsentSince } from '@/lib/analytics/analytics-consent';
import type { FunnelEvent } from '@/lib/analytics/funnel-contract';
import { attributionForOrder } from '@/lib/analytics/session-attribution';

export function growthDevice(): 'desktop' | 'mobile' | 'tablet' | undefined {
  if (analyticsConsentSince() === null) return undefined;
  const { userAgent, maxTouchPoints } = window.navigator;
  if (
    /iPad|Tablet|Android(?!.*Mobile)/i.test(userAgent) ||
    (/Macintosh/i.test(userAgent) && maxTouchPoints > 1)
  )
    return 'tablet';
  return /Mobile|iPhone|iPod/i.test(userAgent) ? 'mobile' : 'desktop';
}

export function sendGrowthMeasurement(event: FunnelEvent): void {
  if ('orderId' in event || typeof window.navigator.sendBeacon !== 'function') return;
  const device = growthDevice();
  if (!device) return;
  try {
    const touch = attributionForOrder()?.touches.at(-1);
    const payload = {
      id: window.crypto.randomUUID(),
      visitId: event.sessionId,
      stage: event.name,
      device,
      productSlugs: [...new Set(event.items.map(({ productId }) => productId))].slice(0, 24),
      source: touch?.source,
      medium: touch?.medium,
      campaign: touch?.campaign,
      campaignId: touch?.campaignId,
    };
    window.navigator.sendBeacon(
      '/api/growth/measurement',
      new Blob([JSON.stringify(payload)], {
        type: 'application/json',
      }),
    );
  } catch {
    // The storefront can continue when a browser cannot send optional telemetry.
  }
}
