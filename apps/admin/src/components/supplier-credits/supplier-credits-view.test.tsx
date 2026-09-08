import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AdminSupplierCredit } from '@/lib/supplier-credits/supplier-credits-model';
import { SupplierCreditsView } from './supplier-credits-view';

const credit: AdminSupplierCredit = {
  id: 'credit-1',
  orderId: 'order-1',
  orderItemId: 'order-item-1',
  returnItemId: 'return-item-1',
  supplierId: 'supplier-1',
  supplierName: 'کارگاه نقره آذر',
  quantity: 2,
  unitSupplierPriceToman: 450000,
  amountToman: 900000,
  appliedAmountToman: 250000,
  status: 'PARTIALLY_APPLIED',
  appliedAt: null,
  voidedAt: null,
  createdAt: '2026-09-08T10:00:00.000Z',
  updatedAt: '2026-09-08T11:00:00.000Z',
  order: { id: 'order-1', orderNumber: 'HS-2801', status: null },
  orderItem: {
    id: 'order-item-1',
    productName: 'انگشتر آذر',
    variantName: 'سایز ۵۲',
    sku: 'RING-52',
  },
  returnItem: {
    id: 'return-item-1',
    returnId: 'return-1',
    quantity: 2,
    disposition: 'RETURN_TO_SUPPLIER',
    returnStatus: null,
    returnReason: null,
    receiveNote: null,
  },
  createdBy: null,
  applications: [
    {
      id: 'application-1',
      settlementId: 'settlement-1',
      amountToman: 250000,
      status: 'ACTIVE',
      removalReason: null,
      removedAt: null,
      createdAt: '2026-09-08T10:30:00.000Z',
      appliedBy: null,
      removedBy: null,
      settlement: null,
    },
  ],
};

function detailResponse() {
  return {
    id: credit.id,
    orderId: credit.orderId,
    orderItemId: credit.orderItemId,
    returnItemId: credit.returnItemId,
    supplierIdSnapshot: credit.supplierId,
    supplierNameSnapshot: credit.supplierName,
    quantity: credit.quantity,
    unitSupplierPriceToman: credit.unitSupplierPriceToman,
    amountToman: credit.amountToman,
    appliedAmountToman: credit.appliedAmountToman,
    status: credit.status,
    appliedAt: null,
    voidedAt: null,
    createdAt: credit.createdAt,
    updatedAt: credit.updatedAt,
    order: { id: credit.orderId, orderNumber: credit.order.orderNumber, status: 'DELIVERED' },
    orderItem: {
      id: credit.orderItemId,
      productNameSnapshot: credit.orderItem.productName,
      variantNameSnapshot: credit.orderItem.variantName,
      skuSnapshot: credit.orderItem.sku,
    },
    returnItem: {
      id: credit.returnItemId,
      returnId: credit.returnItem.returnId,
      quantity: credit.returnItem.quantity,
      disposition: credit.returnItem.disposition,
      orderReturn: {
        status: 'RECEIVED',
        reason: 'ارسال کالای اشتباه',
        receiveNote: 'تحویل انبار شد.',
      },
    },
    createdBy: null,
    applications: credit.applications,
  };
}

describe('SupplierCreditsView', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(detailResponse()), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );
  });

  it('shows financial KPIs, status chart and compact mobile cards', () => {
    render(<SupplierCreditsView credits={[credit]} failed={false} />);

    expect(screen.getByRole('img', { name: /ترکیب وضعیت اعتبارهای تأمین‌کننده/ })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'کارت‌های اعتبار تأمین‌کننده' })).toHaveClass(
      'md:hidden',
    );
    expect(screen.getAllByText('مانده قابل استفاده').length).toBeGreaterThan(0);
    expect(screen.getAllByText('۶۵۰٬۰۰۰ تومان').length).toBeGreaterThan(0);
  });

  it('loads the complete return source and application history on demand', async () => {
    const fetchMock = vi.mocked(fetch);
    render(<SupplierCreditsView credits={[credit]} failed={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'مشاهده اعتبار' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledWith('/api/supplier-credits/credit-1');
    expect(await screen.findByText('ارسال کالای اشتباه')).toBeInTheDocument();
    expect(screen.getByText(/سابقه مصرف/)).toBeInTheDocument();
  });

  it('filters credits by Persian search input', () => {
    render(<SupplierCreditsView credits={[credit]} failed={false} />);

    fireEvent.change(screen.getByRole('searchbox', { name: 'جستجوی اعتبار تأمین‌کننده' }), {
      target: { value: 'ناموجود' },
    });

    expect(screen.getAllByText('نتیجه‌ای پیدا نشد').length).toBeGreaterThan(0);
  });
});
