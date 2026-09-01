import type { OrderStatus } from './status';

export interface OrderStatusHistory {
  id: string;

  orderId: string;

  fromStatus?: OrderStatus | null;

  toStatus: OrderStatus;

  reason?: string | null;

  createdAt: string;
}
