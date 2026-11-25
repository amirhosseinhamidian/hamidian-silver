'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useCampaignExpiration } from '@/components/catalog/use-campaign-expiration';

const CampaignVisibility = createContext<{
  watch: (campaignId: string) => () => void;
  inactiveIds: ReadonlySet<string>;
  festivalVersions: ReadonlyMap<string, number>;
} | null>(null);

export function CampaignVisibilityProvider({ children }: { children: ReactNode }) {
  const registrations = useRef(new Map<string, number>());
  const [inactiveIds, setInactiveIds] = useState<ReadonlySet<string>>(() => new Set());
  const [versions, setVersions] = useState<ReadonlyMap<string, number>>(() => new Map());
  const watch = useCallback((id: string) => {
    const watched = registrations.current;
    watched.set(id, (watched.get(id) ?? 0) + 1);
    return () => {
      const count = watched.get(id) ?? 0;
      if (count > 1) watched.set(id, count - 1);
      else watched.delete(id);
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let pending = false;

    async function refresh() {
      if (pending || document.visibilityState === 'hidden' || !registrations.current.size) return;
      const requested = [...registrations.current.keys()];
      pending = true;
      try {
        const response = await fetch('/api/campaigns/activity', {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok) return;
        const { activeIds, festivalVersions } = (await response.json()) as {
          activeIds?: string[];
          festivalVersions?: Record<string, number>;
        };
        if (!Array.isArray(activeIds) || controller.signal.aborted) return;
        const active = new Set(activeIds);
        const next = new Set(requested.filter((id) => !active.has(id)));
        setInactiveIds((previous) =>
          previous.size === next.size && [...next].every((id) => previous.has(id))
            ? previous
            : next,
        );
        const updated = new Map(
          requested.flatMap((id) => {
            const version = festivalVersions?.[id];
            return typeof version === 'number' && Number.isInteger(version)
              ? [[id, version] as const]
              : [];
          }),
        );
        setVersions((previous) =>
          previous.size === updated.size &&
          [...updated].every(([id, version]) => previous.get(id) === version)
            ? previous
            : updated,
        );
      } catch {
        // Keep the server-rendered presentation when an activity check is unavailable.
      } finally {
        pending = false;
      }
    }

    const initial = window.setTimeout(refresh, 0);
    const timer = window.setInterval(refresh, 30_000);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('pageshow', refresh);
    return () => {
      controller.abort();
      window.clearTimeout(initial);
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('pageshow', refresh);
    };
  }, []);

  return (
    <CampaignVisibility.Provider value={{ watch, inactiveIds, festivalVersions: versions }}>
      {children}
    </CampaignVisibility.Provider>
  );
}

export function useCampaignVisibility(
  campaignId: string | undefined,
  endsAt: string | undefined,
  publicationVersion?: number,
) {
  const activity = useContext(CampaignVisibility);
  const watching = activity?.watch;
  const expired = useCampaignExpiration(endsAt);
  useEffect(() => {
    if (expired || !campaignId || !watching) return;
    return watching(campaignId);
  }, [campaignId, expired, watching]);
  const current = campaignId ? activity?.festivalVersions.get(campaignId) : undefined;
  const superseded =
    publicationVersion !== undefined && current !== undefined && current > publicationVersion;
  return !expired && !superseded && (!campaignId || !activity?.inactiveIds.has(campaignId));
}
