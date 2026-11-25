'use client';

import type { components } from '@hamidian/contracts';
import { useEffect, useState } from 'react';

export type CampaignTaxonomy = components['schemas']['CampaignTaxonomyOptionsDto'];
export type CampaignProductOption = components['schemas']['CampaignProductOptionDto'];
export type CampaignProductOptions = components['schemas']['CampaignProductOptionsDto'];

export function useCampaignSelection<T>(url: string | null, delay = 0, body?: string) {
  const [attempt, setAttempt] = useState(0);
  const key = url && JSON.stringify([url, body, attempt]);
  const [result, setResult] = useState<{ key: string; data?: T; failed?: true } | null>(null);

  useEffect(() => {
    if (!url || !key) return;
    const abort = new AbortController();
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const response = await fetch(url, {
            signal: abort.signal,
            cache: 'no-store',
            ...(body
              ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }
              : {}),
          });
          if (!response.ok) throw new Error('Selection request failed.');
          const data = (await response.json()) as T;
          if (!abort.signal.aborted) setResult({ key, data });
        } catch {
          if (!abort.signal.aborted) setResult({ key, failed: true });
        }
      })();
    }, delay);
    return () => {
      window.clearTimeout(timer);
      abort.abort();
    };
  }, [body, delay, key, url]);

  const current = key && result?.key === key ? result : null;
  return {
    data: current?.data,
    failed: current?.failed,
    loading: Boolean(key && !current),
    retry: () => setAttempt((value) => value + 1),
  };
}

export function useCampaignTaxonomy() {
  return useCampaignSelection<CampaignTaxonomy>('/api/campaigns/selection-taxonomy');
}

export function addCampaignSelection(selected: readonly string[], key: string, max: number) {
  return selected.includes(key) || selected.length >= max ? [...selected] : [...selected, key];
}
