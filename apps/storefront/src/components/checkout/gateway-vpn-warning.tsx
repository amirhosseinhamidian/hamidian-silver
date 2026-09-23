'use client';

import { useEffect, useState } from 'react';

type NetworkLocation = 'checking' | 'iran' | 'outside' | 'unknown';

export function GatewayVpnWarning({ visible }: Readonly<{ visible: boolean }>) {
  const [networkLocation, setNetworkLocation] = useState<NetworkLocation>('checking');

  useEffect(() => {
    if (!visible) return;
    let active = true;

    void fetch('/api/checkout/network-location', { cache: 'no-store' })
      .then(async (response) => {
        if (!active) return;
        if (!response.ok) return setNetworkLocation('unknown');

        const payload = (await response.json()) as { isIranian?: unknown };
        if (payload.isIranian === true) return setNetworkLocation('iran');
        if (payload.isIranian === false) return setNetworkLocation('outside');
        setNetworkLocation('unknown');
      })
      .catch(() => active && setNetworkLocation('unknown'));

    return () => {
      active = false;
    };
  }, [visible]);

  if (!visible || networkLocation === 'checking' || networkLocation === 'iran') return null;

  return (
    <p
      role="note"
      className="mt-3 border-s-2 border-amber-500 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950 lg:mt-4"
    >
      اگر VPN شما روشن است، پیش از رفتن به درگاه بانکی آن را خاموش کنید.
    </p>
  );
}
