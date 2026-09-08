import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SupplierPayablesView } from '@/components/supplier-payables/supplier-payables-view';
import type {
  AdminSupplierPayable,
  AdminSupplierPayableSummary,
} from '@/lib/supplier-payables/supplier-payables-model';

const payable: AdminSupplierPayable = {
  id: 'payable-1',
  orderId: 'order-1',
  orderItemId: 'item-1',
  supplierId: 'supplier-1',
  supplierName: 'نقره‌سازی پارس',
  quantity: 2,
  unitSupplierPriceToman: 750_000,
  amountToman: 1_500_000,
  status: 'OPEN',
  settlementId: null,
  paidAt: null,
  paymentReference: null,
  settlementNote: null,
  createdAt: '2026-09-08T08:00:00.000Z',
  updatedAt: '2026-09-08T08:00:00.000Z',
  order: {
    id: 'order-1',
    orderNumber: 'HS-1405-120',
    status: 'PAID',
    paidAt: '2026-09-08T07:50:00.000Z',
  },
  orderItem: {
    id: 'item-1',
    productName: 'انگشتر نقره',
    variantName: 'سایز ۵۸',
    sku: 'RING-58',
  },
  paidBy: null,
};

const summary: AdminSupplierPayableSummary = {
  supplierId: 'supplier-1',
  supplierName: 'نقره‌سازی پارس',
  openAmountToman: 1_500_000,
  openCount: 1,
  paidAmountToman: 500_000,
  paidCount: 1,
  totalAmountToman: 2_000_000,
  totalCount: 2,
};

describe('SupplierPayablesView', () => {
  it('renders operational KPIs, charts and responsive payable records', () => {
    render(<SupplierPayablesView payables={[payable]} summary={[summary]} failed={false} />);

    expect(screen.getByText('مانده قابل پرداخت')).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'نمودار مانده بدهی تأمین‌کنندگان' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /ترکیب مبلغ بدهی تأمین‌کنندگان/ })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'کارت‌های بدهی تأمین‌کنندگان' })).toBeInTheDocument();
    expect(screen.getAllByText('نقره‌سازی پارس').length).toBeGreaterThan(1);
    expect(screen.getAllByText('آماده ورود به دوره').length).toBeGreaterThan(0);
  });

  it('opens complete payable details from the desktop table', () => {
    render(<SupplierPayablesView payables={[payable]} summary={[summary]} failed={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'مشاهده بدهی' }));

    expect(screen.getByRole('dialog', { name: /بدهی سفارش/ })).toBeInTheDocument();
    expect(screen.getByText('منبع بدهی')).toBeInTheDocument();
    expect(screen.getByText('وضعیت مالی')).toBeInTheDocument();
    expect(screen.getAllByText('پرداخت نشده').length).toBeGreaterThan(0);
  });

  it('filters localized search values and reports an empty result', () => {
    render(<SupplierPayablesView payables={[payable]} summary={[summary]} failed={false} />);

    fireEvent.change(screen.getByRole('searchbox', { name: 'جستجوی بدهی تأمین‌کننده' }), {
      target: { value: '۹۹۹۹' },
    });

    expect(screen.getAllByText('نتیجه‌ای پیدا نشد').length).toBeGreaterThan(0);
  });
});
