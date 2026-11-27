import { render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OrderFunnelAnalytics } from '@/components/analytics/conversion-trackers';
import { setAnalyticsConsent } from '@/lib/analytics/analytics-consent';
import type { OrderFunnelRecord } from '@/lib/analytics/order-funnel';

const purchase = {
  transactionId: 'HS-1001',
  valueToman: 2_150_000,
  shippingToman: 50_000,
  taxToman: 0,
  items: [
    {
      itemId: 'RING-52',
      itemName: 'انگشتر نقره',
      variant: '52 / GOLD',
      priceToman: 1_050_000,
      quantity: 2,
    },
  ],
};

describe('OrderFunnelAnalytics', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    setAnalyticsConsent(true);
    window.gtag = vi.fn();
  });

  afterEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    delete window.gtag;
  });

  it('emits a verified purchase only once across result-page remounts', async () => {
    const records: OrderFunnelRecord[] = [
      {
        event: {
          name: 'purchase_confirmed',
          orderId: 'order-1',
          occurredAt: new Date().toISOString(),
          items: [{ productId: 'RING-52' }],
        },
        purchase,
      },
    ];
    const first = render(<OrderFunnelAnalytics records={records} />);

    await waitFor(() => expect(window.gtag).toHaveBeenCalledOnce());

    first.unmount();
    render(<OrderFunnelAnalytics records={records} />);

    await waitFor(() => expect(window.gtag).toHaveBeenCalledOnce());
  });
});
