import type { components } from '@hamidian/contracts';

import type { CartItem } from '@/lib/cart/cart-state';

type CreateOrderDto = components['schemas']['CreateOrderDto'];
type CreateOrderAddressDto = components['schemas']['CreateOrderAddressDto'];

export function buildCreateOrderBody(
  items: readonly CartItem[],
  shippingAddress: CreateOrderAddressDto,
): CreateOrderDto {
  return {
    shippingAddress,
    items: items.map((item) => ({
      variantId: item.variantId,
      quantity: item.quantity,
      ...(item.platingType ? { platingType: item.platingType } : {}),
    })),
  };
}
