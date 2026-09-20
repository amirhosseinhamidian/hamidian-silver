import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  canShowCustomerReturns,
  canShowCustomerTracking,
  CustomerOrderDetailView,
} from '@/components/account/customer-order-detail';
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
  it('only exposes customer returns for an authorized shipped or delivered order', () => {
    expect(canShowCustomerReturns({ status: 'DELIVERED', returnAuthorized: false })).toBe(false);
    expect(canShowCustomerReturns({ status: 'DELIVERED', returnAuthorized: true })).toBe(true);
    expect(canShowCustomerReturns({ status: 'SHIPPED', returnAuthorized: true })).toBe(true);
    expect(canShowCustomerReturns({ status: 'PROCESSING', returnAuthorized: true })).toBe(false);
  });

  it('hides shipment tracking after the order is delivered', () => {
    expect(canShowCustomerTracking({ status: 'DELIVERED', trackingCode: 'POST-123' })).toBe(false);
    expect(canShowCustomerTracking({ status: 'SHIPPED', trackingCode: 'POST-123' })).toBe(true);
  });

  it('renders the customer order items, timeline, address, totals, and tracking code', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const fetchMock = vi.fn().mockResolvedValueOnce(
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
        returnAuthorized: true,
        trackingCode: 'POST-123',
        shippingMethodName: 'پست پیشتاز',
        shippingTrackingUrl: 'https://tracking.post.ir/',
        shippingCarrierLogoUrl: 'https://media.example/post-logo.webp',
        shippingPayOnDelivery: false,
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
            platingType: 'ROSE_GOLD',
            platingWeightGrams: '0.5',
            platingRateToman: 200_000,
            platingLeadTimeDays: 2,
            unitWeightGrams: '4.25',
            unitSalePriceToman: 1_500_000,
            unitPlatingPriceToman: 50_000,
            lineTotalToman: 3_100_000,
            returnableQuantity: 2,
            createdAt: '2026-09-05T12:00:00.000Z',
          },
        ],
      }),
    );
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    vi.stubGlobal('fetch', fetchMock);

    const { container } = render(<CustomerOrderDetailView orderId="order/1" />);

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
    expect(screen.getByText('پست پیشتاز')).toBeInTheDocument();
    expect(screen.getByText('آبکاری رزگلد')).toBeInTheDocument();
    expect(screen.getByText('آبکاری رزگلد').parentElement).toHaveAttribute(
      'data-plating-type',
      'ROSE_GOLD',
    );
    expect(
      container.querySelector('img[src="https://media.example/post-logo.webp"]'),
    ).toHaveAttribute('src', 'https://media.example/post-logo.webp');
    fireEvent.click(screen.getByRole('button', { name: 'کپی کد رهگیری' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('POST-123'));
    expect(screen.getByRole('button', { name: 'کپی شد' })).toBeInTheDocument();
    expect(
      screen.getByText(/برای مشاهده آخرین وضعیت مرسوله، کد رهگیری را کپی کنید/),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'استعلام وضعیت' })).toHaveAttribute(
      'href',
      'https://tracking.post.ir/',
    );
    expect(screen.getByText(formatTomanPrice(2_950_000))).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'مرجوعی سفارش' })).toBeInTheDocument();

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/orders/order%2F1', { cache: 'no-store' }),
    );
  });

  it('shows receipt review as the current timeline state for card-to-card payments', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(
        jsonResponse({
          id: 'order-2',
          orderNumber: 'HS-1002',
          status: 'PENDING_PAYMENT',
          payment: {
            status: 'AWAITING_REVIEW',
            method: 'CARD_TO_CARD',
            receiptAvailable: true,
            receiptOriginalName: 'receipt.jpg',
            receiptUploadedAt: '2026-09-05T12:05:00.000Z',
          },
          merchandiseTotalToman: 2_000_000,
          platingTotalToman: 0,
          discountTotalToman: 0,
          shippingTotalToman: 0,
          taxTotalToman: 0,
          grandTotalToman: 2_000_000,
          returnAuthorized: false,
          trackingCode: null,
          shippingMethodName: null,
          shippingTrackingUrl: null,
          shippingCarrierLogoUrl: null,
          shippingPayOnDelivery: false,
          reservationExpiresAt: '2026-09-05T12:15:00.000Z',
          paidAt: null,
          cancelledAt: null,
          deliveredAt: null,
          createdAt: '2026-09-05T12:00:00.000Z',
          updatedAt: '2026-09-05T12:05:00.000Z',
          statusHistory: [
            {
              fromStatus: null,
              toStatus: 'PENDING_PAYMENT',
              createdAt: '2026-09-05T12:00:00.000Z',
            },
          ],
          items: [],
          shippingAddress: {},
        }),
      ),
    );

    render(<CustomerOrderDetailView orderId="order-2" />);

    const timelineHeading = await screen.findByRole('heading', { name: 'روند سفارش' });
    const timeline = timelineHeading.closest('section');
    expect(timeline).not.toBeNull();
    expect(within(timeline!).getByText('در انتظار بررسی رسید')).toBeInTheDocument();
    expect(within(timeline!).queryByText('در انتظار پرداخت')).not.toBeInTheDocument();
    expect(screen.getByText('رایگان')).toBeInTheDocument();
  });
});
