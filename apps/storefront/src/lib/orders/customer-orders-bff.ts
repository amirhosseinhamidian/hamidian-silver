import type { components } from '@hamidian/contracts';
import { cookies } from 'next/headers';

import { createServerApiClient } from '@/lib/api/server-client';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { getCatalogDevProductImageSrc } from '@/lib/catalog/dev-media.server';

type ContractOrder = components['schemas']['CustomerOrderSummaryDto'];
type OrderWithCatalogMedia = ContractOrder & {
  trackingCode: string | null;
  items: Array<
    ContractOrder['items'][number] & {
      productSlug: string;
      primaryMedia: components['schemas']['PublicCatalogMediaDto'] | null;
      fallbackSrc: string | null;
    }
  >;
};

function authenticationRequired(): Response {
  return Response.json({ message: 'Authentication required.' }, { status: 401 });
}

export async function listCustomerOrders(): Promise<Response> {
  const accessToken = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!accessToken) return authenticationRequired();

  const apiOrigin = process.env.HAMIDIAN_API_ORIGIN;
  if (!apiOrigin) {
    throw new Error('HAMIDIAN_API_ORIGIN is required for order requests.');
  }

  const client = createServerApiClient({ apiOrigin, accessToken });
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

  const orders = ordersResult.data as OrderWithCatalogMedia[];
  return Response.json({
    total: countResult.data.count,
    items: orders.map((order) => ({
      ...order,
      items: order.items.map((item) => ({
        ...item,
        fallbackSrc: item.productSlug ? getCatalogDevProductImageSrc(item.productSlug) : null,
      })),
    })),
  });
}
