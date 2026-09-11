import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  cookieGet: vi.fn(),
  readJsonResponse: vi.fn(),
  requestAdminCatalog: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ get: mocks.cookieGet })),
}));
vi.mock('@/lib/catalog/catalog-api', () => ({
  readJsonResponse: mocks.readJsonResponse,
  requestAdminCatalog: mocks.requestAdminCatalog,
}));

import { forwardInventoryMutation } from '@/lib/inventory/inventory-bff';
import { forwardOrderMutation } from '@/lib/orders/orders-bff';
import { forwardPaymentOperation } from '@/lib/payments/payment-operations-bff';
import { forwardRefundMutation } from '@/lib/refunds/refunds-bff';
import { forwardReturnMutation } from '@/lib/returns/returns-bff';
import { forwardSupplierSettlement } from '@/lib/supplier-settlements/supplier-settlements-bff';

type CriticalOperation = Readonly<{
  name: string;
  invoke: () => Promise<Response>;
}>;

function request(body = { reason: 'operator-review' }): Request {
  return new Request('http://admin.local/api/critical-operation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const operations: readonly CriticalOperation[] = [
  {
    name: 'order status',
    invoke: () => forwardOrderMutation(request(), '/api/v1/orders/order-1/status', 'PATCH'),
  },
  {
    name: 'payment recovery',
    invoke: () =>
      forwardPaymentOperation(request(), '/api/v1/payments/initiation-recovery/attempt-1/resolve'),
  },
  {
    name: 'payment reconciliation',
    invoke: () =>
      forwardPaymentOperation(
        request(),
        '/api/v1/payments/reconciliations/reconciliation-1/resolve-external-refund',
      ),
  },
  {
    name: 'refund',
    invoke: () => forwardRefundMutation(request(), '/api/v1/finance/refunds/refund-1/confirm'),
  },
  {
    name: 'inventory adjustment',
    invoke: () => forwardInventoryMutation(request(), '/api/v1/inventory/stock/adjust', 'POST'),
  },
  {
    name: 'order return',
    invoke: () => forwardReturnMutation(request(), '/api/v1/orders/returns/return-1/receive'),
  },
  {
    name: 'supplier settlement',
    invoke: () =>
      forwardSupplierSettlement(
        request(),
        '/api/v1/finance/supplier-settlements/settlement-1/pay',
        'POST',
      ),
  },
];

describe.each(operations)('$name critical-operation BFF', ({ invoke }) => {
  beforeEach(() => {
    mocks.cookieGet.mockReset();
    mocks.readJsonResponse.mockReset();
    mocks.requestAdminCatalog.mockReset();
  });

  it('rejects the mutation before contacting the API when the session is missing', async () => {
    mocks.cookieGet.mockReturnValue(undefined);

    const response = await invoke();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ message: 'Authentication required.' });
    expect(mocks.requestAdminCatalog).not.toHaveBeenCalled();
  });

  it.each([403, 409])('preserves an upstream %s response', async (status) => {
    const payload = { message: status === 403 ? 'Forbidden.' : 'Concurrent operation conflict.' };
    mocks.cookieGet.mockReturnValue({ value: 'admin-session-token' });
    mocks.requestAdminCatalog.mockResolvedValue(new Response(JSON.stringify(payload), { status }));
    mocks.readJsonResponse.mockResolvedValue(payload);

    const response = await invoke();

    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual(payload);
    expect(mocks.requestAdminCatalog).toHaveBeenCalledTimes(1);
    expect(mocks.requestAdminCatalog).toHaveBeenCalledWith(
      expect.stringMatching(/^\/api\/v1\//),
      'admin-session-token',
      expect.objectContaining({ method: expect.stringMatching(/^(POST|PATCH)$/) }),
    );
  });

  it('maps an unavailable upstream service to a controlled 502 response', async () => {
    mocks.cookieGet.mockReturnValue({ value: 'admin-session-token' });
    mocks.requestAdminCatalog.mockImplementation(() => {
      throw new Error('upstream unavailable');
    });

    const response = await invoke();

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual(
      expect.objectContaining({ message: expect.stringContaining('unavailable') }),
    );
  });
});
