import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AdminSupplierCredit } from '@/lib/supplier-credits/supplier-credits-model';
import type { AdminSupplierPayable } from '@/lib/supplier-payables/supplier-payables-model';
import type { AdminSupplierSettlement } from '@/lib/supplier-settlements/supplier-settlements-model';
import { SupplierSettlementsView } from './supplier-settlements-view';

const { refreshMock } = vi.hoisted(() => ({ refreshMock: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: refreshMock }) }));

const settlement: AdminSupplierSettlement = {
  id: 'settlement-1',
  supplierId: 'supplier-1',
  supplierName: 'نقره‌سازی پارس',
  status: 'DRAFT',
  totalAmountToman: 1_500_000,
  creditAppliedToman: 300_000,
  paidAmountToman: null,
  payableCount: 1,
  note: 'تسویه شهریور',
  paymentReference: null,
  paidAt: null,
  cancelledAt: null,
  createdAt: '2026-09-08T10:00:00.000Z',
  updatedAt: '2026-09-08T10:00:00.000Z',
  createdBy: null,
  paidBy: null,
  cancelledBy: null,
  items: [],
  creditApplications: [],
};

const payable: AdminSupplierPayable = {
  id: 'payable-1',
  orderId: 'order-1',
  orderItemId: 'order-item-1',
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
  createdAt: '2026-09-08T09:00:00.000Z',
  updatedAt: '2026-09-08T09:00:00.000Z',
  order: {
    id: 'order-1',
    orderNumber: 'HS-3010',
    status: 'PAID',
    paidAt: '2026-09-08T08:50:00.000Z',
  },
  orderItem: {
    id: 'order-item-1',
    productName: 'انگشتر نقره',
    variantName: 'سایز ۵۸',
    sku: 'RING-58',
  },
  paidBy: null,
};

const credit: AdminSupplierCredit = {
  id: 'credit-1',
  orderId: 'returned-order-1',
  orderItemId: 'returned-item-1',
  returnItemId: 'return-item-1',
  supplierId: 'supplier-1',
  supplierName: 'نقره‌سازی پارس',
  quantity: 1,
  unitSupplierPriceToman: 500_000,
  amountToman: 500_000,
  appliedAmountToman: 0,
  status: 'AVAILABLE',
  appliedAt: null,
  voidedAt: null,
  createdAt: '2026-09-08T08:00:00.000Z',
  updatedAt: '2026-09-08T08:00:00.000Z',
  order: { id: 'returned-order-1', orderNumber: 'HS-3001', status: 'DELIVERED' },
  orderItem: {
    id: 'returned-item-1',
    productName: 'دستبند نقره',
    variantName: null,
    sku: 'BRACELET-1',
  },
  returnItem: {
    id: 'return-item-1',
    returnId: 'return-1',
    quantity: 1,
    disposition: 'RETURN_TO_SUPPLIER',
    returnStatus: 'RECEIVED',
    returnReason: 'ارسال اشتباه',
    receiveNote: null,
  },
  createdBy: null,
  applications: [],
};

function detailResponse() {
  return {
    id: settlement.id,
    supplierIdSnapshot: settlement.supplierId,
    supplierNameSnapshot: settlement.supplierName,
    status: settlement.status,
    totalAmountToman: settlement.totalAmountToman,
    creditAppliedToman: settlement.creditAppliedToman,
    paidAmountToman: null,
    payableCount: 1,
    note: settlement.note,
    paymentReference: null,
    paidAt: null,
    cancelledAt: null,
    createdAt: settlement.createdAt,
    updatedAt: settlement.updatedAt,
    createdBy: null,
    paidBy: null,
    cancelledBy: null,
    items: [
      {
        id: 'settlement-item-1',
        payableId: payable.id,
        amountToman: payable.amountToman,
        createdAt: settlement.createdAt,
        payable: {
          id: payable.id,
          orderId: payable.orderId,
          status: payable.status,
          supplierIdSnapshot: payable.supplierId,
          supplierNameSnapshot: payable.supplierName,
          quantity: payable.quantity,
          unitSupplierPriceToman: payable.unitSupplierPriceToman,
          amountToman: payable.amountToman,
          order: { orderNumber: payable.order.orderNumber },
          orderItem: {
            productNameSnapshot: payable.orderItem.productName,
            variantNameSnapshot: payable.orderItem.variantName,
            skuSnapshot: payable.orderItem.sku,
          },
        },
      },
    ],
    creditApplications: [],
  };
}

function renderView(canWrite = true) {
  return render(
    <SupplierSettlementsView
      settlements={[settlement]}
      payables={[payable]}
      credits={[credit]}
      failed={false}
      canWrite={canWrite}
    />,
  );
}

describe('SupplierSettlementsView', () => {
  beforeEach(() => {
    refreshMock.mockReset();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('renders settlement KPIs, status chart and responsive records', () => {
    renderView();

    expect(screen.getByText('خالص در انتظار')).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: /ترکیب وضعیت دوره‌های تسویه تأمین‌کنندگان/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'کارت‌های دوره تسویه' })).toHaveClass('md:hidden');
    expect(screen.getAllByText('۱٬۲۰۰٬۰۰۰ تومان').length).toBeGreaterThan(0);
  });

  it('creates a batch from selected open payables of one supplier', async () => {
    const fetchMock = vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'created-settlement' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    renderView();

    fireEvent.click(screen.getByRole('button', { name: 'ایجاد batch تسویه' }));
    fireEvent.click(screen.getByRole('checkbox', { name: /انگشتر نقره/ }));
    fireEvent.click(screen.getByRole('button', { name: 'ساخت دوره' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/supplier-settlements',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ payableIds: ['payable-1'] }),
      }),
    );
    expect(refreshMock).toHaveBeenCalledOnce();
  });

  it('loads full batch membership before financial operations', async () => {
    const fetchMock = vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(detailResponse()), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    renderView();

    fireEvent.click(screen.getByRole('button', { name: 'مدیریت batch' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledWith('/api/supplier-settlements/settlement-1');
    expect(await screen.findByText('اقلام بدهی · ۱ رکورد')).toBeInTheDocument();
    expect(screen.getAllByText('انگشتر نقره').length).toBeGreaterThan(0);
  });

  it('keeps financial actions hidden for read-only users', () => {
    renderView(false);

    expect(screen.queryByRole('button', { name: 'ایجاد batch تسویه' })).not.toBeInTheDocument();
    expect(screen.getByText('دسترسی شما به دوره‌های تسویه فقط‌خواندنی است.')).toBeInTheDocument();
  });
});
