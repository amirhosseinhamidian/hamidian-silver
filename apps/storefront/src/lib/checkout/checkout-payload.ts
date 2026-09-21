import type { components } from '@hamidian/contracts';

import type { CartItem } from '@/lib/cart/cart-state';

type CreateOrderDto = components['schemas']['CreateOrderDto'];
type CheckoutAddress =
  | Readonly<{ userAddressId: string }>
  | Readonly<{ shippingAddress: components['schemas']['CreateOrderAddressDto'] }>
  | components['schemas']['CreateOrderAddressDto'];

export function buildCreateOrderBody(
  items: readonly CartItem[],
  address: CheckoutAddress,
  shippingCarrierId?: string,
  customerNote?: string,
): CreateOrderDto {
  const orderAddress = 'recipientName' in address ? { shippingAddress: address } : address;
  const normalizedCustomerNote = customerNote?.trim();

  return {
    ...orderAddress,
    ...(shippingCarrierId ? { shippingCarrierId } : {}),
    ...(normalizedCustomerNote ? { customerNote: normalizedCustomerNote } : {}),
    items: items.map((item) => ({
      variantId: item.variantId,
      quantity: item.quantity,
      ...(item.platingType ? { platingType: item.platingType } : {}),
    })),
  };
}
