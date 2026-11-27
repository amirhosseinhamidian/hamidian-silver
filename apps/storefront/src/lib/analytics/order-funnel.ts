import type { CustomerOrderDetail } from '@/components/account/account-types';
import type { PurchaseInput } from '@/lib/analytics/commerce-events';
import type { OrderFunnelEvent } from '@/lib/analytics/funnel-contract';
import { verifiedPaymentStatus } from '@/lib/checkout/verified-payment-status';

type OrderItem = CustomerOrderDetail['items'][number];
type ItemIdentity = Pick<OrderItem, 'productSlug' | 'skuSnapshot' | 'variantId' | 'quantity'>;
type Submission = Pick<CustomerOrderDetail, 'id' | 'createdAt'> &
  Readonly<{ items: readonly ItemIdentity[] }>;
export type OrderFunnelRecord = Readonly<{
  event: OrderFunnelEvent;
  purchase?: PurchaseInput;
}>;

function itemId(item: ItemIdentity) {
  return item.productSlug || item.skuSnapshot || item.variantId;
}

function orderFunnelItems(items: readonly ItemIdentity[]) {
  return items.map((item) => ({
    productId: itemId(item),
    variantId: item.variantId,
    quantity: item.quantity,
  }));
}

export function submittedOrderEvent(order: Submission): OrderFunnelEvent {
  return {
    name: 'order_submitted',
    orderId: order.id,
    occurredAt: order.createdAt,
    items: orderFunnelItems(order.items ?? []),
  };
}

export function verifiedOrderFunnel(order: CustomerOrderDetail): OrderFunnelRecord[] {
  const records: OrderFunnelRecord[] = [];
  if (verifiedPaymentStatus(order.status) === 'success' && order.paidAt) {
    const items = order.items ?? [];
    records.push({
      event: {
        name: 'purchase_confirmed',
        orderId: order.id,
        occurredAt: order.paidAt,
        items: orderFunnelItems(items),
      },
      purchase: {
        transactionId: order.orderNumber,
        valueToman: Math.max(
          0,
          order.grandTotalToman - order.shippingTotalToman - order.taxTotalToman,
        ),
        shippingToman: order.shippingTotalToman,
        taxToman: order.taxTotalToman,
        items: items.map((item) => ({
          itemId: itemId(item),
          itemName: item.productNameSnapshot,
          variant: [item.variantNameSnapshot, item.sizeLabelSnapshot, item.platingType]
            .filter(Boolean)
            .join(' / '),
          priceToman: item.unitSalePriceToman + item.unitPlatingPriceToman,
          quantity: item.quantity,
        })),
      },
    });
  }
  if (order.status === 'CANCELLED' && order.cancelledAt) {
    records.push({
      event: { name: 'cancellation', orderId: order.id, occurredAt: order.cancelledAt },
    });
  }
  for (const refund of order.confirmedRefunds ?? []) {
    records.push({
      event: {
        name: 'refund_adjustment',
        orderId: order.id,
        refundId: refund.id,
        occurredAt: refund.confirmedAt,
        amountToman: refund.amountToman,
      },
    });
  }
  return records;
}
