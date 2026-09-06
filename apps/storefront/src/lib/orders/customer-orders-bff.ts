import type { components } from '@hamidian/contracts';
import { cookies } from 'next/headers';

import { createServerApiClient } from '@/lib/api/server-client';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { getCatalogDevProductImageSrc } from '@/lib/catalog/dev-media.server';

type ContractOrder = components['schemas']['CustomerOrderSummaryDto'];
type ContractOrderDetail = components['schemas']['CustomerOrderDetailDto'];
type ContractOrderItem = components['schemas']['CustomerOrderItemDto'];
type EnrichedOrderItem = ContractOrderItem & { fallbackSrc: string | null };
type EnrichedOrder<Order extends { items: ContractOrderItem[] }> = Omit<Order, 'items'> & {
  items: EnrichedOrderItem[];
};

function authenticationRequired(): Response {
  return Response.json({ message: 'Authentication required.' }, { status: 401 });
}

function createCustomerOrdersClient(accessToken: string) {
  const apiOrigin = process.env.HAMIDIAN_API_ORIGIN;
  if (!apiOrigin) {
    throw new Error('HAMIDIAN_API_ORIGIN is required for order requests.');
  }

  return createServerApiClient({ apiOrigin, accessToken });
}

function enrichOrder<Order extends { items: ContractOrderItem[] }>(
  order: Order,
): EnrichedOrder<Order> {
  return {
    ...order,
    items: order.items.map((item) => ({
      ...item,
      fallbackSrc: item.productSlug ? getCatalogDevProductImageSrc(item.productSlug) : null,
    })),
  };
}

export async function listCustomerOrders(): Promise<Response> {
  const accessToken = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!accessToken) return authenticationRequired();

  const client = createCustomerOrdersClient(accessToken);
  const [ordersResult, countResult] = await Promise.all([
    client.GET('/api/v1/orders/me'),
    client.GET('/api/v1/orders/me/count'),
  ]);

  if (!ordersResult.response.ok || !ordersResult.data) {
    return Response.json(ordersResult.error ?? null, { status: ordersResult.response.status });
  }
  if (!countResult.response.ok || !countResult.data) {
    return Response.json(countResult.error ?? null, { status: countResult.response.status });
  }

  const orders = ordersResult.data as ContractOrder[];
  return Response.json({
    total: countResult.data.count,
    items: orders.map(enrichOrder),
  });
}

export async function getCustomerOrder(orderId: string): Promise<Response> {
  const accessToken = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!accessToken) return authenticationRequired();

  const client = createCustomerOrdersClient(accessToken);
  const { data, error, response } = await client.GET('/api/v1/orders/me/{orderId}', {
    params: { path: { orderId } },
  });

  if (!response.ok || !data) {
    return Response.json(error ?? null, { status: response.status });
  }

  return Response.json(enrichOrder(data as ContractOrderDetail));
}
