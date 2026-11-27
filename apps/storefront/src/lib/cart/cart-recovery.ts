import type { components } from '@hamidian/contracts';

export type SavedCartVersion = components['schemas']['SavedCartVersionDto'];
export type SavedCartStatus = components['schemas']['SavedCartStatusDto'];
export type SavedCartReview = components['schemas']['SavedCartReviewDto'];

export const cartRecoveryUrl = '/api/cart/recovery';

export function cartRecoveryAction(
  action: 'preview' | 'restore' | 'hide' | 'discard',
  version: SavedCartVersion & { reviewKey?: string },
  signal: AbortSignal,
) {
  return fetch(`${cartRecoveryUrl}?action=${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(version),
    cache: 'no-store',
    signal,
  });
}
