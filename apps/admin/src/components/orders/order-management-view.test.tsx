import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { OrderManagementView } from '@/components/orders/order-management-view';
import type { AdminOrder } from '@/lib/orders/orders-model';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const order: AdminOrder = {
  id: 'order-1',
  orderNumber: 'HS-1234',
  status: 'PAID',
  merchandiseTotalToman: 1_200_000,
  platingTotalToman: 100_000,
  discountTotalToman: 50_000,
  shippingTotalToman: 80_000,
  taxTotalToman: 0,
  grandTotalToman: 1_330_000,
  reservationExpiresAt: '2026-09-07T12:15:00.000Z',
  paidAt: '2026-09-07T12:05:00.000Z',
  cancelledAt: null,
  deliveredAt: null,
  shippingSelection: null,
  returnAuthorization: null,
  createdAt: '2026-09-07T12:00:00.000Z',
  updatedAt: '2026-09-07T12:05:00.000Z',
  customer: { id: 'user-1', name: 'علی رضایی', phone: '09121234567' },
  address: {
    recipientName: 'علی رضایی',
    phone: '09121234567',
    province: 'تهران',
    city: 'تهران',
    addressLine: 'خیابان نمونه، پلاک ۱۲',
    postalCode: '1234567890',
  },
  items: [
    {
      id: 'item-1',
      productName: 'انگشتر آذر',
      variantName: 'سایز ۵۲',
      sku: 'RING-52',
      sizeLabel: '52',
      quantity: 2,
      unitSalePriceToman: 600_000,
      unitSupplierPriceToman: 400_000,
      supplierName: 'نقره‌سازی پارس',
      platingType: 'GOLD',
      unitPlatingPriceToman: 50_000,
      platingLeadTimeDays: 2,
      unitWeightGrams: 4.25,
      lineTotalToman: 1_300_000,
    },
  ],
  payment: {
    id: 'payment-1',
    status: 'PAID',
    amountToman: 1_330_000,
    refundedAmountToman: 0,
    paidAt: '2026-09-07T12:05:00.000Z',
    updatedAt: '2026-09-07T12:05:00.000Z',
    attempts: [
      {
        id: 'attempt-1',
        provider: 'ZARINPAL',
        status: 'VERIFIED',
        amountToman: 1_330_000,
        providerReference: 'REF-123',
        failureCode: null,
        failureMessage: null,
        verifiedAt: '2026-09-07T12:05:00.000Z',
        receiptMimeType: null,
        receiptOriginalName: null,
        receiptSizeBytes: null,
        receiptUploadedAt: null,
        createdAt: '2026-09-07T12:02:00.000Z',
      },
    ],
  },
  shipment: null,
  timeline: [
    {
      id: 'history-1',
      fromStatus: 'PENDING_PAYMENT',
      toStatus: 'PAID',
      reason: 'Payment verified',
      actor: 'مدیر فروش',
      createdAt: '2026-09-07T12:05:00.000Z',
    },
  ],
};

describe('OrderManagementView', () => {
  it('renders operational KPIs, a chart, desktop table and mobile cards', () => {
    render(<OrderManagementView orders={[order]} failed={false} />);
    expect(screen.getByRole('img', { name: /توزیع وضعیت سفارش‌ها/ })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'کارت‌های سفارش' })).toHaveClass('md:hidden');
    expect(screen.getAllByText('HS-۱۲۳۴').length).toBeGreaterThan(0);
    expect(screen.getAllByText('۱٬۳۳۰٬۰۰۰ تومان').length).toBeGreaterThan(0);
  });

  it('opens complete order details in a bottom sheet on mobile', async () => {
    render(<OrderManagementView orders={[order]} failed={false} />);
    const mobileCards = screen.getByRole('region', { name: 'کارت‌های سفارش' });
    fireEvent.click(within(mobileCards).getByRole('button', { name: 'مشاهده جزئیات و عملیات' }));
    const dialog = await screen.findByRole('dialog', { name: 'سفارش HS-۱۲۳۴' });
    expect(within(dialog).getByText('مشتری و آدرس تحویل')).toBeInTheDocument();
    expect(within(dialog).getByText('انگشتر آذر')).toBeInTheDocument();
    expect(within(dialog).getByText('تاریخچه وضعیت')).toBeInTheDocument();
    expect(within(dialog).getByText('۱۲۳۴۵۶۷۸۹۰')).toBeInTheDocument();
  });

  it('presents card-to-card review without an operational mismatch or cancellation action', async () => {
    const awaitingReviewOrder: AdminOrder = {
      ...order,
      status: 'PENDING_PAYMENT',
      paidAt: null,
      payment: order.payment && {
        ...order.payment,
        status: 'AWAITING_REVIEW',
        paidAt: null,
        attempts: [
          {
            ...order.payment.attempts[0]!,
            provider: 'card_to_card',
            status: 'AWAITING_REVIEW',
            verifiedAt: null,
            receiptMimeType: 'image/jpeg',
            receiptOriginalName: 'receipt.jpg',
            receiptSizeBytes: 120_000,
            receiptUploadedAt: '2026-09-07T12:04:00.000Z',
          },
        ],
      },
    };
    render(<OrderManagementView orders={[awaitingReviewOrder]} failed={false} canCancel />);
    const mobileCards = screen.getByRole('region', { name: 'کارت‌های سفارش' });
    fireEvent.click(within(mobileCards).getByRole('button', { name: 'مشاهده جزئیات و عملیات' }));
    const dialog = await screen.findByRole('dialog', { name: 'سفارش HS-۱۲۳۴' });

    expect(within(dialog).queryByText('این سفارش نیازمند بررسی است')).not.toBeInTheDocument();
    expect(within(dialog).getByText('پرداخت کارت‌به‌کارت ثبت شده است')).toBeInTheDocument();
    expect(within(dialog).getAllByText('کارت‌به‌کارت').length).toBeGreaterThan(0);
    expect(within(dialog).queryByText('لغو مدیریتی سفارش')).not.toBeInTheDocument();
    expect(within(dialog).getAllByText('در انتظار بررسی رسید').length).toBeGreaterThan(0);
  });

  it('labels the initial card-to-card timeline step as receipt registration', async () => {
    const approvedCardToCardOrder: AdminOrder = {
      ...order,
      payment: order.payment && {
        ...order.payment,
        attempts: [
          {
            ...order.payment.attempts[0]!,
            provider: 'card_to_card',
            providerReference: 'CARD-HS-1234',
          },
        ],
      },
      timeline: [
        {
          id: 'history-created',
          fromStatus: null,
          toStatus: 'PENDING_PAYMENT',
          reason: 'Order created',
          actor: 'امیرحسین حمیدیان',
          createdAt: '2026-09-07T12:00:00.000Z',
        },
        ...order.timeline,
      ],
    };
    render(<OrderManagementView orders={[approvedCardToCardOrder]} failed={false} />);
    const mobileCards = screen.getByRole('region', { name: 'کارت‌های سفارش' });
    fireEvent.click(within(mobileCards).getByRole('button', { name: 'مشاهده جزئیات و عملیات' }));
    const dialog = await screen.findByRole('dialog', { name: 'سفارش HS-۱۲۳۴' });

    expect(within(dialog).getByText('در انتظار ثبت رسید کارت‌به‌کارت')).toBeInTheDocument();
    expect(within(dialog).queryByText('در انتظار پرداخت')).not.toBeInTheDocument();
  });

  it('filters orders by localized search input', () => {
    render(<OrderManagementView orders={[order]} failed={false} />);
    fireEvent.change(screen.getByRole('searchbox', { name: 'جستجوی سفارش' }), {
      target: { value: '۹۹۹۹' },
    });
    expect(screen.getAllByText('سفارشی با این فیلتر پیدا نشد').length).toBeGreaterThan(0);
  });
});
