import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AdminOrderReturn } from '@/lib/returns/returns-model';
import { ReturnManagementView } from './return-management-view';

const { refreshMock } = vi.hoisted(() => ({ refreshMock: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: refreshMock }) }));

const orderReturn: AdminOrderReturn = {
  id: 'return-1',
  orderId: 'order-1',
  orderNumber: 'HS-2701',
  orderStatus: 'DELIVERED',
  warehouseId: 'warehouse-1',
  status: 'REQUESTED',
  reason: 'سایز کالا مناسب نیست.',
  receiveNote: null,
  cancelReason: null,
  requestedBy: { id: 'user-1', phone: '09121234567', firstName: 'مینا', lastName: 'محمدی' },
  receivedBy: null,
  cancelledBy: null,
  receivedAt: null,
  cancelledAt: null,
  createdAt: '2026-09-08T10:00:00.000Z',
  updatedAt: '2026-09-08T10:00:00.000Z',
  items: [
    {
      id: 'return-item-1',
      orderItemId: 'order-item-1',
      quantity: 1,
      disposition: null,
      orderItem: {
        productName: 'انگشتر آذر',
        variantName: 'سایز ۵۲',
        sku: 'RING-52',
        soldQuantity: 2,
        allocatedQuantity: 1,
        returnedQuantity: 0,
        supplierId: 'supplier-1',
        supplierName: 'تأمین نقره',
        unitSupplierPriceToman: 450000,
      },
      supplierCredit: null,
    },
  ],
};

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function apiReturn(overrides: Record<string, unknown> = {}) {
  return {
    ...orderReturn,
    order: {
      id: orderReturn.orderId,
      orderNumber: orderReturn.orderNumber,
      status: orderReturn.orderStatus,
      warehouseId: orderReturn.warehouseId,
    },
    items: orderReturn.items.map((item) => ({
      id: item.id,
      orderItemId: item.orderItemId,
      quantity: item.quantity,
      disposition: item.disposition,
      orderItem: {
        productNameSnapshot: item.orderItem.productName,
        variantNameSnapshot: item.orderItem.variantName,
        skuSnapshot: item.orderItem.sku,
        quantity: item.orderItem.soldQuantity,
        returnAllocatedQuantity: item.orderItem.allocatedQuantity,
        returnedQuantity: item.orderItem.returnedQuantity,
        supplierIdSnapshot: item.orderItem.supplierId,
        supplierNameSnapshot: item.orderItem.supplierName,
        unitSupplierPriceToman: item.orderItem.unitSupplierPriceToman,
      },
      supplierCredit: item.supplierCredit,
    })),
    ...overrides,
  };
}

describe('ReturnManagementView', () => {
  beforeEach(() => {
    refreshMock.mockReset();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('shows status chart, allocation and compact mobile cards', () => {
    render(<ReturnManagementView returns={[orderReturn]} failed={false} canReject canReceive />);
    expect(screen.getByRole('img', { name: /ترکیب وضعیت مرجوعی‌ها/ })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'کارت‌های مرجوعی' })).toHaveClass('md:hidden');
    expect(screen.getAllByText('تخصیص فعال').length).toBeGreaterThan(0);
  });

  it('rejects a request with an auditable reason', async () => {
    const cancelled = apiReturn({
      status: 'CANCELLED',
      cancelReason: 'کالا مشمول شرایط مرجوعی نیست.',
      cancelledAt: '2026-09-08T11:00:00.000Z',
      cancelledBy: { id: 'admin-1', phone: '09120000000', firstName: null, lastName: null },
    });
    const fetchMock = vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(cancelled));
    render(<ReturnManagementView returns={[orderReturn]} failed={false} canReject canReceive />);
    fireEvent.click(screen.getByRole('button', { name: 'جزئیات و بررسی' }));
    fireEvent.click(screen.getByRole('button', { name: 'رد درخواست' }));
    fireEvent.change(screen.getByLabelText(/دلیل رد درخواست/), {
      target: { value: 'کالا مشمول شرایط مرجوعی نیست.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'تأیید رد درخواست' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/order-returns/return-1/cancel',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ reason: 'کالا مشمول شرایط مرجوعی نیست.' }),
      }),
    );
    expect(await screen.findByText(/تخصیص آن آزاد شد/)).toBeInTheDocument();
    expect(refreshMock).toHaveBeenCalledOnce();
  });

  it('requires a disposition for every received item', () => {
    render(<ReturnManagementView returns={[orderReturn]} failed={false} canReject canReceive />);
    fireEvent.click(screen.getByRole('button', { name: 'جزئیات و بررسی' }));
    fireEvent.click(screen.getByRole('button', { name: 'تأیید و ثبت دریافت' }));
    fireEvent.click(screen.getByRole('button', { name: 'ثبت دریافت' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'برای همه اقلام، مسیر تعیین تکلیف را انتخاب کنید.',
    );
    expect(fetch).not.toHaveBeenCalled();
  });
});
