'use client';

import { useEffect, useState } from 'react';
import { AUTHENTICATION_ENDED_EVENT, AUTHENTICATION_SUCCEEDED_EVENT } from '@/lib/auth/events';
import type { WalletBalance } from '@/lib/wallet/wallet-presentation';

type WalletState =
  { status: 'loading' | 'anonymous' | 'error' } | { status: 'ready'; balance: WalletBalance };

export function useWalletBalance(enabled = true) {
  const [state, setState] = useState<WalletState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const refresh = () => setAttempt((value) => value + 1);

  useEffect(() => {
    if (!enabled) return;
    let pending: AbortController | undefined;
    function load() {
      pending?.abort();
      const controller = new AbortController();
      pending = controller;
      void fetch('/api/wallet', { cache: 'no-store', signal: controller.signal })
        .then(async (response) => {
          if (controller.signal.aborted) return;
          if (response.status === 401) {
            setState({ status: 'anonymous' });
            return;
          }
          if (!response.ok) throw new Error('Wallet unavailable');
          const balance = (await response.json()) as WalletBalance;
          if (!Number.isSafeInteger(balance.availableToman))
            throw new Error('Invalid wallet balance');
          if (!controller.signal.aborted) setState({ status: 'ready', balance });
        })
        .catch(() => {
          if (!controller.signal.aborted) setState({ status: 'error' });
        });
    }
    function signOut() {
      pending?.abort();
      setState({ status: 'anonymous' });
    }
    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) load();
    }
    function onVisible() {
      if (document.visibilityState === 'visible') load();
    }
    load();
    window.addEventListener('pageshow', onPageShow);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener(AUTHENTICATION_SUCCEEDED_EVENT, load);
    window.addEventListener(AUTHENTICATION_ENDED_EVENT, signOut);
    return () => {
      pending?.abort();
      window.removeEventListener('pageshow', onPageShow);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener(AUTHENTICATION_SUCCEEDED_EVENT, load);
      window.removeEventListener(AUTHENTICATION_ENDED_EVENT, signOut);
    };
  }, [enabled, attempt]);

  return { state, refresh };
}
