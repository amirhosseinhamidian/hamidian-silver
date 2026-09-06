import { render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CustomerOrderDetailView } from '@/components/account/customer-order-detail';
import { formatTomanPrice } from '@/lib/catalog/presentation';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CustomerOrderDetailView', () => {
  it('renders the customer order items, timeline, address, totals, and tracking code', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        id: 'order/1',
        orderNumber: 'HS-1001',
        status: 'SHIPPED',
        merchandiseTotalToman: 3_000_000,
        platingTotalToman: 100_000,
        discountTotalToman: 200_000,
        shippingTotalToman: 50_000,
        taxTotalToman: 0,
        grandTotalToman: 2_950_000,
        trackingCode: 'POST-123',
        reservationExpiresAt: '2026-09-05T13:00:00.000Z',
        paidAt: '2026-09-05T12:10:00.000Z',
        cancelledAt: null,
        deliveredAt: null,
        createdAt: '2026-09-05T12:00:00.000Z',
        updatedAt: '2026-09-06T08:00:00.000Z',
        shippingAddress: {
          recipientName: 'امیرحسین حمیدیان',
          phone: '09121234567',
          province: 'تهران',
          city: 'تهران',
          addressLine: 'خیابان ولیعصر، پلاک 12',
          postalCode: '1234567890',
        },
        statusHistory: [
          {
            fromStatus: null,
            toStatus: 'PENDING_PAYMENT',
            createdAt: '2026-09-05T12:00:00.000Z',
          },
          {
            fromStatus: 'PROCESSING',
            toStatus: 'SHIPPED',
            createdAt: '2026-09-06T08:00:00.000Z',
          },
        ],
        items: [
          {
            id: 'item-1',
            variantId: 'variant-1',
            quantity: 2,
            productNameSnapshot: 'انگشتر نقره مهتاب',
            productSlug: 'silver-ring',
            primaryMedia: {
              url: 'https://media.example/ring.webp',
              mimeType: 'image/webp',
              altText: 'انگشتر نقره مهتاب',
              width: 800,
              height: 800,
            },
            fallbackSrc: null,
            variantNameSnapshot: 'مدل اصلی',
            skuSnapshot: 'RING-1001',
            sizeLabelSnapshot: '7',
            platingType: 'GOLD',
            platingWeightGrams: '0.5',
            platingRateToman: 200_000,
            platingLeadTimeDays: 2,
            unitWeightGrams: '4.25',
            unitSalePriceToman: 1_500_000,
            unitPlatingPriceToman: 50_000,
            lineTotalToman: 3_100_000,
            createdAt: '2026-09-05T12:00:00.000Z',
          },
        ],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    render(<CustomerOrderDetailView orderId="order/1" />);

    expect(
      await screen.findByRole('heading', { name: 'جزئیات سفارش', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText('سفارش HS-۱۰۰۱')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'انگشتر نقره مهتاب' })).toHaveAttribute(
      'src',
      'https://media.example/ring.webp',
    );

    const timeline = screen.getByRole('heading', { name: 'روند سفارش' }).closest('section');
    expect(timeline).not.toBeNull();
    expect(within(timeline!).getByText('در انتظار پرداخت')).toBeInTheDocument();
    expect(within(timeline!).getByText('ارسال‌شده')).toBeInTheDocument();

    expect(screen.getByText('خیابان ولیعصر، پلاک ۱۲', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('POST-۱۲۳')).toBeInTheDocument();
    expect(screen.getByText(formatTomanPrice(2_950_000))).toBeInTheDocument();

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/orders/order%2F1', { cache: 'no-store' }),
    );
  });
});
