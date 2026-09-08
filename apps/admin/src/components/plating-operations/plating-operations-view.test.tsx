import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AdminPlatingOrder } from '@/lib/plating-operations/plating-operations-model';
import { PlatingOperationsView } from './plating-operations-view';

const { refreshMock } = vi.hoisted(() => ({ refreshMock: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: refreshMock }) }));

function order(status: AdminPlatingOrder['fulfillmentStatus'] = 'PENDING'): AdminPlatingOrder {
  return {
    orderId: 'order-1',
    orderNumber: 'HS-2301',
    orderStatus: 'PROCESSING',
    paidAt: '2026-09-01T10:00:00.000Z',
    platingTotalToman: 250_000,
    fulfillmentStatus: status,
    items: [
      {
        id: 'item-1',
        productName: 'انگشتر آذر',
        variantName: 'سایز ۵۲',
        sku: 'RING-52',
        quantity: 1,
        platingType: 'GOLD',
        platingWeightGrams: 4.25,
        leadTimeDays: 3,
      },
    ],
    fulfillment:
      status === 'PENDING'
        ? null
        : {
            id: 'fulfillment-1',
            orderId: 'order-1',
            status,
            actualCostToman: null,
            externalReference: null,
            startNote: 'تحویل به کارگاه',
            completionNote: null,
            cancellationReason: null,
            startedAt: '2026-09-01T12:00:00.000Z',
            completedAt: null,
            cancelledAt: null,
            createdAt: '2026-09-01T12:00:00.000Z',
            updatedAt: '2026-09-01T12:00:00.000Z',
            startedBy: null,
            completedBy: null,
            cancelledBy: null,
          },
  };
}

describe('PlatingOperationsView', () => {
  beforeEach(() => {
    refreshMock.mockReset();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('renders responsive queue, SLA controls and workload chart', () => {
    render(<PlatingOperationsView orders={[order()]} failed={false} canOperate canComplete />);
    expect(screen.getByRole('img', { name: 'نمودار توزیع وضعیت صف آبکاری' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'کارت‌های صف آبکاری' })).toHaveClass('md:hidden');
    expect(screen.getByLabelText('فیلتر SLA آبکاری')).toBeInTheDocument();
  });

  it('starts a pending plating order with an audit note', async () => {
    const fetchMock = vi.mocked(fetch).mockResolvedValue(new Response('{}', { status: 201 }));
    render(<PlatingOperationsView orders={[order()]} failed={false} canOperate canComplete />);
    fireEvent.click(screen.getAllByRole('button', { name: 'شروع آبکاری' })[0]);
    fireEvent.change(screen.getByLabelText(/یادداشت عملیات/), {
      target: { value: 'تحویل به کارگاه مرکزی' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'تأیید نهایی' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/plating-operations/orders/order-1/start',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ note: 'تحویل به کارگاه مرکزی' }),
      }),
    );
  });

  it('normalizes Persian cost digits before completing', async () => {
    const fetchMock = vi.mocked(fetch).mockResolvedValue(new Response('{}', { status: 200 }));
    render(
      <PlatingOperationsView
        orders={[order('IN_PROGRESS')]}
        failed={false}
        canOperate
        canComplete
      />,
    );
    fireEvent.click(screen.getAllByRole('button', { name: 'تکمیل و ثبت هزینه' })[0]);
    fireEvent.change(screen.getByLabelText(/هزینه واقعی آبکاری/), {
      target: { value: '۱۴۰۰۰۰' },
    });
    fireEvent.change(screen.getByLabelText(/یادداشت عملیات/), {
      target: { value: 'فاکتور کارگاه دریافت شد' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'تأیید نهایی' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/plating-operations/orders/order-1/complete',
      expect.objectContaining({
        body: JSON.stringify({
          actualCostToman: 140_000,
          note: 'فاکتور کارگاه دریافت شد',
        }),
      }),
    );
  });
});
