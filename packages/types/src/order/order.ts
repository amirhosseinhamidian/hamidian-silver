import type { OrderItem } from './item';
import type { OrderStatus } from './status';
import type { OrderAddress } from './address';

export interface Order {
  id: string;

  orderNumber: string;

  userId: string;

  status: OrderStatus;

  merchandiseTotalToman: number;
  platingTotalToman: number;
  discountTotalToman: number;
  shippingTotalToman: number;
  taxTotalToman: number;
  grandTotalToman: number;

  reservationExpiresAt: string;

  paidAt?: string | null;
  cancelledAt?: string | null;
  deliveredAt?: string | null;

  createdAt: string;
  updatedAt: string;

  shippingAddress?: OrderAddress | null;
  items?: OrderItem[];
}
