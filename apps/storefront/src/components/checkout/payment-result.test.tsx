import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { CustomerOrderDetail } from '@/components/account/account-types';
import { PaymentResult } from '@/components/checkout/payment-result';
import { formatTomanPrice } from '@/lib/catalog/presentation';

const order: CustomerOrderDetail = {
  id: 'order-1',
  orderNumber: 'HS-1001',
  status: 'PAID',
  merchandiseTotalToman: 2_000_000,
  platingTotalToman: 100_000,
  discountTotalToman: 0,
  shippingTotalToman: 50_000,
  taxTotalToman: 0,
  grandTotalToman: 2_150_000,
  returnAuthorized: false,
  trackingCode: null,
  reservationExpiresAt: '2026-09-07T13:00:00.000Z',
  paidAt: '2026-09-07T12:02:00.000Z',
  cancelledAt: null,
  deliveredAt: null,
  createdAt: '2026-09-07T12:00:00.000Z',
  updatedAt: '2026-09-07T12:02:00.000Z',
  shippingAddress: {
    recipientName: 'امیرحسین حمیدیان',
    phone: '09121234567',
    province: 'تهران',
    city: 'تهران',
    addressLine: 'خیابان نمونه، پلاک 12',
    postalCode: '1234567890',
  },
  statusHistory: [
    { fromStatus: null, toStatus: 'PENDING_PAYMENT', createdAt: '2026-09-07T12:00:00.000Z' },
    { fromStatus: 'PENDING_PAYMENT', toStatus: 'PAID', createdAt: '2026-09-07T12:02:00.000Z' },
  ],
  items: [
    {
      id: 'item-1',
      variantId: 'variant-1',
      quantity: 2,
      productNameSnapshot: 'انگشتر نقره مدل 2',
      productSlug: 'silver-ring',
      primaryMedia: null,
      fallbackSrc: '/dev-media/silver-ring.webp',
      variantNameSnapshot: null,
      skuSnapshot: 'RING-52',
      sizeLabelSnapshot: '52',
      platingType: 'GOLD',
      platingWeightGrams: null,
      platingRateToman: null,
      platingLeadTimeDays: 2,
      unitWeightGrams: '4.5',
      unitSalePriceToman: 1_000_000,
      unitPlatingPriceToman: 50_000,
      lineTotalToman: 2_100_000,
      returnableQuantity: 0,
      createdAt: '2026-09-07T12:00:00.000Z',
    },
  ],
};

describe('PaymentResult', () => {
  afterEach(() => {
    window.localStorage.clear();
    delete window.gtag;
  });

  it('renders a complete verified purchase summary', () => {
    render(<PaymentResult status="success" order={order} />);

    expect(
      screen.getByRole('heading', { name: 'خرید شما با موفقیت تکمیل شد' }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('HS-۱۰۰۱')).toHaveLength(2);
    expect(screen.getByRole('heading', { name: 'کالاهای سفارش' })).toBeInTheDocument();
    expect(screen.getByText('انگشتر نقره مدل ۲')).toBeInTheDocument();
    expect(screen.getByText('۲ کالا')).toBeInTheDocument();
    expect(screen.getAllByText(formatTomanPrice(2_150_000))).not.toHaveLength(0);
    expect(screen.getByRole('heading', { name: 'نشانی تحویل' })).toBeInTheDocument();
    expect(screen.getByText('خیابان نمونه، پلاک ۱۲', { exact: false })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'از اینجا به بعد' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'مشاهده جزئیات سفارش' })).toHaveAttribute(
      'href',
      '/account/orders/order-1',
    );
  });

  it('warns against retrying an uncertain payment and links to verification', () => {
    render(<PaymentResult status="pending" order={{ ...order, status: 'PENDING_PAYMENT' }} />);

    expect(
      screen.getByRole('heading', { name: 'نتیجه پرداخت در حال بررسی است' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/پرداخت را تکرار نکنید/)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'از اینجا به بعد' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'بررسی وضعیت سفارش' })).toHaveAttribute(
      'href',
      '/account/orders/order-1',
    );
  });

  it('keeps a safe fallback when verified order details are unavailable', () => {
    render(<PaymentResult status="failed" orderId="order-2" />);

    expect(screen.getByRole('heading', { name: 'پرداخت تکمیل نشد' })).toBeInTheDocument();
    expect(screen.getByText(/جزئیات سفارش را از حساب کاربری باز کنید/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'بررسی و تلاش مجدد' })).toHaveAttribute(
      'href',
      '/account/orders/order-2',
    );
  });

  it('emits purchase only for a verified successful order', async () => {
    const gtag = vi.fn();
    window.gtag = gtag;
    const pending = render(
      <PaymentResult status="pending" order={{ ...order, status: 'PENDING_PAYMENT' }} />,
    );

    expect(gtag).not.toHaveBeenCalled();
    pending.unmount();

    render(<PaymentResult status="success" order={order} />);

    await waitFor(() =>
      expect(gtag).toHaveBeenCalledWith(
        'event',
        'purchase',
        expect.objectContaining({ transaction_id: 'HS-1001', currency: 'IRR' }),
      ),
    );
  });
});
