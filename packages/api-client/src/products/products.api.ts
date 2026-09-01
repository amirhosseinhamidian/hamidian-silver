import type { Product, PaginatedResponse } from '@hamidian/types';

import { apiClient } from '../client';

export function getProducts() {
  return apiClient.get<PaginatedResponse<Product>>('/products');
}

export function getProduct(id: string) {
  return apiClient.get<Product>(`/products/${id}`);
}
