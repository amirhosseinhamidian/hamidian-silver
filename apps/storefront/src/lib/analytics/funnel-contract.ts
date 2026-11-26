export const FUNNEL_EVENT_VERSION = 1;

export type FunnelItem = Readonly<{
  productId: string;
  variantId?: string;
  quantity?: number;
}>;

export type CatalogList =
  | 'catalog'
  | 'search'
  | 'category'
  | 'brand'
  | 'product_recommendations'
  | 'cart_recommendations'
  | 'campaign_recommendations';

type CatalogEvent = Readonly<{
  name: 'view_item_list' | 'select_item';
  list: CatalogList;
  items: readonly FunnelItem[];
}>;

type CartEvent = Readonly<{
  name: 'view_item' | 'add_to_cart' | 'begin_checkout';
  items: readonly FunnelItem[];
}>;

export type OrderFunnelEvent = Readonly<{
  orderId: string;
  occurredAt: string;
}> &
  (
    | Readonly<{ name: 'order_submitted' | 'purchase_confirmed'; items: readonly FunnelItem[] }>
    | Readonly<{ name: 'cancellation' }>
    | Readonly<{ name: 'refund_adjustment'; refundId: string; amountToman: number }>
  );

export type FunnelEventInput = CatalogEvent | CartEvent | OrderFunnelEvent;

export type FunnelEvent = Readonly<{
  version: typeof FUNNEL_EVENT_VERSION;
  eventId: string;
  sessionId: string;
  occurredAt: string;
  campaignId?: string;
}> &
  FunnelEventInput;

const IDENTIFIER = new RegExp('^[\\p{L}\\p{N}_-]{1,100}$', 'u');

function isIdentifier(value: string): boolean {
  return typeof value === 'string' && IDENTIFIER.test(value);
}

export function projectFunnelEvent(input: FunnelEventInput): FunnelEventInput | null {
  const items =
    'items' in input
      ? input.items
          .slice(0, 100)
          .filter(({ productId }) => isIdentifier(productId))
          .map(({ productId, variantId, quantity }) => ({
            productId,
            ...(variantId && isIdentifier(variantId) ? { variantId } : {}),
            ...(quantity !== undefined && Number.isSafeInteger(quantity) && quantity > 0
              ? { quantity }
              : {}),
          }))
      : [];

  if (!('orderId' in input)) {
    if (items.length === 0) return null;
    return 'list' in input
      ? { name: input.name, list: input.list, items }
      : { name: input.name, items };
  }

  if (!isIdentifier(input.orderId) || !Number.isFinite(Date.parse(input.occurredAt))) return null;
  const order = { orderId: input.orderId, occurredAt: input.occurredAt };
  switch (input.name) {
    case 'order_submitted':
    case 'purchase_confirmed':
      return { ...order, name: input.name, items };
    case 'cancellation':
      return { ...order, name: input.name };
    case 'refund_adjustment':
      return isIdentifier(input.refundId) &&
        Number.isSafeInteger(input.amountToman) &&
        input.amountToman > 0
        ? { ...order, name: input.name, refundId: input.refundId, amountToman: input.amountToman }
        : null;
  }
}
