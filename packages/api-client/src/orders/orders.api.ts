import type { Order, PaginatedResponse } from '@hamidian/types';

import { apiClient } from '../client';

export function getOrders() {
  return apiClient.get<PaginatedResponse<Order>>('/orders');
}

export function getOrder(id: string) {
  return apiClient.get<Order>(`/orders/${id}`);
}
