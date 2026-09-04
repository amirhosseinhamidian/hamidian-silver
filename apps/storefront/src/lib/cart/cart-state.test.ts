import { describe, expect, it } from 'vitest';

import {
  addCartItem,
  cartItemKey,
  deserializeCart,
  getCartItemCount,
  getCartSubtotalToman,
  setCartItemQuantity,
  type AddCartItemInput,
} from '@/lib/cart/cart-state';

const baseItem: AddCartItemInput = {
  variantId: '10000000-0000-4000-8000-000000000001',
  productSlug: 'silver-ring',
  productName: 'انگشتر نقره',
  variantLabel: 'سایز ۵۲',
  media: null,
  unitSalePriceToman: 800_000,
  platingType: null,
  unitPlatingPriceToman: 0,
  platingLeadTimeDays: 0,
  quantity: 1,
  maxQuantity: 3,
};

describe('cart state', () => {
  it('merges identical variant/plating selections and caps them at current availability', () => {
    const once = addCartItem([], baseItem);
    const twice = addCartItem(once, {
      ...baseItem,
      quantity: 3,
    });

    expect(twice).toHaveLength(1);
    expect(twice[0]?.quantity).toBe(3);
    expect(twice[0]?.key).toBe(cartItemKey(baseItem.variantId, null));
  });

  it('keeps different plating selections as separate order lines', () => {
    const withoutPlating = addCartItem([], baseItem);
    const withGold = addCartItem(withoutPlating, {
      ...baseItem,
      platingType: 'GOLD',
      unitPlatingPriceToman: 25_000,
      platingLeadTimeDays: 2,
    });

    expect(withGold).toHaveLength(2);
    expect(getCartItemCount(withGold)).toBe(2);
    expect(getCartSubtotalToman(withGold)).toBe(1_625_000);
  });

  it('clamps quantity changes and removes unsafe persisted entries', () => {
    const items = addCartItem([], baseItem);
    const updated = setCartItemQuantity(items, items[0]!.key, 20);

    expect(updated[0]?.quantity).toBe(3);

    const restored = deserializeCart(
      JSON.stringify([
        {
          ...baseItem,
          key: 'untrusted-key',
          quantity: 2,
        },
        {
          ...baseItem,
          variantId: '',
        },
      ]),
    );

    expect(restored).toHaveLength(1);
    expect(restored[0]?.key).toBe(cartItemKey(baseItem.variantId, null));
    expect(restored[0]?.quantity).toBe(2);
  });
});
