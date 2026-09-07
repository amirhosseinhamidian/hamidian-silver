import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { OrderManagementView } from '@/components/orders/order-management-view';
import type { AdminOrder } from '@/lib/orders/orders-model';

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

  it('filters orders by localized search input', () => {
    render(<OrderManagementView orders={[order]} failed={false} />);
    fireEvent.change(screen.getByRole('searchbox', { name: 'جستجوی سفارش' }), {
      target: { value: '۹۹۹۹' },
    });
    expect(screen.getAllByText('سفارشی با این فیلتر پیدا نشد').length).toBeGreaterThan(0);
  });
});
