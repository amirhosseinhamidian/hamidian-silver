import { render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PurchaseAnalytics } from '@/components/analytics/conversion-trackers';

const purchase = {
  orderId: 'order-1',
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

describe('PurchaseAnalytics', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.gtag = vi.fn();
  });

  afterEach(() => {
    window.localStorage.clear();
    delete window.gtag;
  });

  it('emits a verified purchase only once across result-page remounts', async () => {
    const first = render(<PurchaseAnalytics {...purchase} />);

    await waitFor(() => expect(window.gtag).toHaveBeenCalledOnce());

    first.unmount();
    render(<PurchaseAnalytics {...purchase} />);

    await waitFor(() => expect(window.gtag).toHaveBeenCalledOnce());
  });
});
