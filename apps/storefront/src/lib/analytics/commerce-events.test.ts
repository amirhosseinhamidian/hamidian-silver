import { afterEach, describe, expect, it, vi } from 'vitest';

import { tomanToIrr } from '@/lib/analytics/analytics';
import {
  toAnalyticsItem,
  trackAddToCart,
  trackBeginCheckout,
  trackProductView,
  trackPurchase,
  trackSearch,
  trackWishlistChange,
} from '@/lib/analytics/commerce-events';

describe('storefront analytics events', () => {
  afterEach(() => {
    delete window.gtag;
  });

  it('converts storefront toman values to the ISO IRR currency unit', () => {
    expect(tomanToIrr(825_000)).toBe(8_250_000);
    expect(
      toAnalyticsItem({
        itemId: 'variant-1',
        itemName: 'انگشتر نقره',
        priceToman: 825_000,
        quantity: 2,
      }),
    ).toMatchObject({
      item_id: 'variant-1',
      item_name: 'انگشتر نقره',
      price: 8_250_000,
      quantity: 2,
    });
  });

  it('emits the expected search, wishlist, cart and checkout events', () => {
    const gtag = vi.fn();
    window.gtag = gtag;
    const item = {
      itemId: 'variant-1',
      itemName: 'انگشتر نقره',
      brand: 'حمیدیان',
      category: 'انگشتر',
      priceToman: 800_000,
      quantity: 1,
    };

    trackSearch('انگشتر نقره', 6);
    trackProductView(item);
    trackWishlistChange(item, true);
    trackWishlistChange(item, false);
    trackAddToCart(item);
    trackBeginCheckout(800_000, [item]);

    expect(gtag).toHaveBeenNthCalledWith(1, 'event', 'search', {
      search_term: 'انگشتر نقره',
      results_count: 6,
    });
    expect(gtag).toHaveBeenNthCalledWith(
      2,
      'event',
      'view_item',
      expect.objectContaining({ currency: 'IRR', value: 8_000_000 }),
    );
    expect(gtag).toHaveBeenNthCalledWith(
      3,
      'event',
      'add_to_wishlist',
      expect.objectContaining({ currency: 'IRR', value: 8_000_000 }),
    );
    expect(gtag).toHaveBeenNthCalledWith(
      4,
      'event',
      'remove_from_wishlist',
      expect.objectContaining({ currency: 'IRR' }),
    );
    expect(gtag).toHaveBeenNthCalledWith(
      5,
      'event',
      'add_to_cart',
      expect.objectContaining({ currency: 'IRR', value: 8_000_000 }),
    );
    expect(gtag).toHaveBeenNthCalledWith(
      6,
      'event',
      'begin_checkout',
      expect.objectContaining({ currency: 'IRR', value: 8_000_000 }),
    );
  });

  it('uses only commerce data in the purchase event', () => {
    const gtag = vi.fn();
    window.gtag = gtag;

    trackPurchase({
      transactionId: 'HS-1001',
      valueToman: 2_150_000,
      shippingToman: 50_000,
      taxToman: 0,
      items: [
        {
          itemId: 'RING-52',
          itemName: 'انگشتر نقره',
          variant: 'سایز ۵۲ / GOLD',
          priceToman: 1_050_000,
          quantity: 2,
        },
      ],
    });

    expect(gtag).toHaveBeenCalledWith('event', 'purchase', {
      transaction_id: 'HS-1001',
      currency: 'IRR',
      value: 21_500_000,
      shipping: 500_000,
      tax: 0,
      items: [
        {
          item_id: 'RING-52',
          item_name: 'انگشتر نقره',
          item_variant: 'سایز ۵۲ / GOLD',
          price: 10_500_000,
          quantity: 2,
        },
      ],
    });
  });

  it('is a safe no-op while analytics is disabled', () => {
    expect(trackSearch('انگشتر', 0)).toBe(false);
  });
});
