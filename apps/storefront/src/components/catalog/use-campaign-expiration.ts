'use client';

import { useEffect, useState } from 'react';

export function useCampaignExpiration(endsAt: string | undefined) {
  const [expired, setExpired] = useState<string | undefined>();
  useEffect(() => {
    if (!endsAt) return;
    const expiry = Date.parse(endsAt);

    let timer: number;
    function schedule() {
      window.clearTimeout(timer);
      const delay = expiry - Date.now();
      if (!Number.isFinite(expiry) || delay <= 0) {
        setExpired(endsAt);
        return;
      }
      timer = window.setTimeout(schedule, Math.min(2_147_483_647, delay));
    }
    timer = window.setTimeout(schedule, 0);
    window.addEventListener('pageshow', schedule);
    document.addEventListener('visibilitychange', schedule);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('pageshow', schedule);
      document.removeEventListener('visibilitychange', schedule);
    };
  }, [endsAt]);

  return Boolean(endsAt && endsAt === expired);
}
