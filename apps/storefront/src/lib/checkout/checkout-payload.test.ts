import { describe, expect, it } from 'vitest';

import type { CartItem } from '@/lib/cart/cart-state';
import { buildCreateOrderBody } from './checkout-payload';

const baseItem: CartItem = {
  key: 'variant-1:NONE',
  variantId: '11111111-1111-4111-8111-111111111111',
  productSlug: 'silver-ring',
  productName: 'انگشتر نقره',
  variantLabel: 'سایز ۵۴',
  media: null,
  unitSalePriceToman: 3_000_000,
  platingType: null,
  unitPlatingPriceToman: 0,
  platingLeadTimeDays: 0,
  quantity: 2,
  maxQuantity: 4,
};

const address = {
  recipientName: 'امیر حمیدیان',
  phone: '09120000000',
  province: 'تهران',
  city: 'تهران',
  addressLine: 'خیابان نمونه، پلاک ۱',
  postalCode: '1234567890',
};

describe('buildCreateOrderBody', () => {
  it('sends only server-authoritative cart identifiers and quantities', () => {
    expect(buildCreateOrderBody([baseItem], address)).toEqual({
      shippingAddress: address,
      items: [
        {
          variantId: baseItem.variantId,
          quantity: 2,
        },
      ],
    });
  });

  it('includes the selected plating type without sending client price snapshots', () => {
    const body = buildCreateOrderBody(
      [
        {
          ...baseItem,
          key: 'variant-1:GOLD',
          platingType: 'GOLD',
          unitPlatingPriceToman: 250_000,
        },
      ],
      address,
    );

    expect(body.items).toEqual([
      {
        variantId: baseItem.variantId,
        quantity: 2,
        platingType: 'GOLD',
      },
    ]);
    expect(JSON.stringify(body)).not.toContain('unitSalePriceToman');
    expect(JSON.stringify(body)).not.toContain('unitPlatingPriceToman');
  });
});
