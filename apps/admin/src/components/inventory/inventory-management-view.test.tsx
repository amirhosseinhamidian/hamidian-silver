import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { InventoryManagementView } from '@/components/inventory/inventory-management-view';
import type { AdminInventoryItem, AdminWarehouse } from '@/lib/inventory/inventory-model';

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

const warehouse: AdminWarehouse = {
  id: '20000000-0000-4000-8000-000000000001',
  code: 'MAIN',
  name: 'انبار مرکزی',
  isDefault: true,
  isActive: true,
  createdAt: '2026-09-07T10:00:00.000Z',
  updatedAt: '2026-09-07T11:00:00.000Z',
};

const item: AdminInventoryItem = {
  inventoryId: '40000000-0000-4000-8000-000000000001',
  warehouseId: warehouse.id,
  productId: 'product-1',
  productName: 'انگشتر آذر',
  productSlug: 'azar-ring',
  productStatus: 'ACTIVE',
  variantId: '30000000-0000-4000-8000-000000000001',
  sku: 'RING-52',
  variantName: 'سایز ۵۲',
  sizeLabel: '۵۲',
  variantActive: true,
  onHand: 10,
  reserved: 4,
  available: 6,
  lowStockThreshold: 3,
  isLowStock: false,
  updatedAt: '2026-09-07T11:00:00.000Z',
};

function view(canWrite = true) {
  return (
    <InventoryManagementView
      warehouses={[warehouse]}
      items={[item]}
      selectedWarehouseId={warehouse.id}
      warehousesFailed={false}
      itemsFailed={false}
      canWrite={canWrite}
    />
  );
}

describe('InventoryManagementView', () => {
  it('renders desktop inventory data and compact mobile cards with Persian numbers', () => {
    render(view());
    expect(screen.getByRole('region', { name: 'کارت‌های موجودی' })).toHaveClass('md:hidden');
    expect(screen.getAllByText('انگشتر آذر').length).toBeGreaterThan(0);
    expect(screen.getAllByText('۶').length).toBeGreaterThan(0);
  });

  it('submits localized stock adjustments with a required reason', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    render(view());
    fireEvent.click(screen.getByRole('button', { name: 'مشاهده جزئیات و عملیات' }));
    const dialog = await screen.findByRole('dialog', { name: 'انگشتر آذر' });
    fireEvent.change(within(dialog).getByLabelText(/مقدار تغییر/), { target: { value: '۵' } });
    fireEvent.change(within(dialog).getByLabelText(/دلیل اصلاح/), {
      target: { value: 'دریافت از تأمین‌کننده' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'ثبت اصلاح موجودی' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/inventory/stock/adjust',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"onHandDelta":5'),
      }),
    );
    expect(router.refresh).toHaveBeenCalled();
  });

  it('keeps mutation controls unavailable for read-only users', async () => {
    render(view(false));
    fireEvent.click(screen.getByRole('button', { name: 'مشاهده جزئیات و عملیات' }));
    const dialog = await screen.findByRole('dialog', { name: 'انگشتر آذر' });
    expect(within(dialog).getByText('دسترسی شما برای این بخش فقط مشاهده است.')).toBeInTheDocument();
    expect(
      within(dialog).queryByRole('button', { name: 'ثبت اصلاح موجودی' }),
    ).not.toBeInTheDocument();
  });
});
