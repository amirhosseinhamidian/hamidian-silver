'use client';

import { useEffect, useState } from 'react';

export function useCampaignExpiration(endsAt: string | undefined) {
  const [expired, setExpired] = useState<string | undefined>();
  useEffect(() => {
    if (!endsAt) return;
    const expiry = Date.parse(endsAt);
    if (!Number.isFinite(expiry)) return;
    let timer: number;
    function schedule() {
      const delay = expiry - Date.now();
      timer = window.setTimeout(
        () => {
          if (Date.now() >= expiry) setExpired(endsAt);
          else schedule();
        },
        Math.min(2_147_483_647, Math.max(0, delay)),
      );
    }
    schedule();
    return () => window.clearTimeout(timer);
  }, [endsAt]);

  return Boolean(endsAt && endsAt === expired);
}
