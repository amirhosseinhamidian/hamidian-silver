import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { InventoryAlertsView } from '@/components/inventory-alerts/inventory-alerts-view';
import type { AdminStockNotificationSummary } from '@/lib/inventory-alerts/inventory-alerts-model';
import type { AdminInventoryItem, AdminWarehouse } from '@/lib/inventory/inventory-model';

const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

afterEach(() => vi.clearAllMocks());

const warehouse: AdminWarehouse = {
  id: 'warehouse-1',
  code: 'MAIN',
  name: 'انبار مرکزی',
  isDefault: true,
  isActive: true,
  createdAt: '2026-09-07T09:00:00.000Z',
  updatedAt: '2026-09-07T10:00:00.000Z',
};

const inventory: readonly AdminInventoryItem[] = [
  {
    inventoryId: 'inventory-1',
    warehouseId: warehouse.id,
    productId: 'product-1',
    productName: 'انگشتر آذر',
    productSlug: 'azar-ring',
    productStatus: 'ACTIVE',
    productPrimaryMedia: null,
    variantId: 'variant-1',
    sku: 'RING-52',
    variantName: 'سایز ۵۲',
    sizeLabel: '۵۲',
    variantActive: true,
    onHand: 4,
    reserved: 4,
    available: 0,
    lowStockThreshold: 2,
    isLowStock: true,
    updatedAt: '2026-09-07T10:00:00.000Z',
  },
  {
    inventoryId: 'inventory-2',
    warehouseId: warehouse.id,
    productId: 'product-2',
    productName: 'دستبند مهتاب',
    productSlug: 'mahtab-bracelet',
    productStatus: 'ACTIVE',
    productPrimaryMedia: null,
    variantId: 'variant-2',
    sku: 'BRACELET-1',
    variantName: null,
    sizeLabel: null,
    variantActive: true,
    onHand: 8,
    reserved: 1,
    available: 7,
    lowStockThreshold: 2,
    isLowStock: false,
    updatedAt: '2026-09-07T10:00:00.000Z',
  },
];

const notifications: AdminStockNotificationSummary = {
  totals: { active: 3, queued: 1, notified: 4, cancelled: 0 },
  targets: [
    {
      id: 'product-1:variant-1',
      productId: 'product-1',
      productName: 'انگشتر آذر',
      productSlug: 'azar-ring',
      productStatus: 'ACTIVE',
      variantId: 'variant-1',
      sku: 'RING-52',
      variantName: 'سایز ۵۲',
      sizeLabel: '۵۲',
      variantActive: true,
      activeCount: 3,
      queuedCount: 1,
      notifiedCount: 4,
      cancelledCount: 0,
      lastRequestedAt: '2026-09-07T10:00:00.000Z',
      lastNotifiedAt: null,
    },
  ],
};

function view(overrides: Partial<ComponentProps<typeof InventoryAlertsView>> = {}) {
  return (
    <InventoryAlertsView
      warehouses={[warehouse]}
      inventory={inventory}
      selectedWarehouseId={warehouse.id}
      warehousesFailed={false}
      inventoryFailed={false}
      notifications={notifications}
      notificationsFailed={false}
      canEditCatalog
      {...overrides}
    />
  );
}

describe('InventoryAlertsView', () => {
  it('shows inventory health, actionable alerts and notification demand', () => {
    render(view());
    expect(screen.getByRole('img', { name: 'توزیع سلامت موجودی؛ مجموع ۲' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'کارت‌های هشدار موجودی' })).toHaveClass('md:hidden');
    expect(screen.getByRole('region', { name: 'کارت‌های درخواست اطلاع‌رسانی' })).toHaveClass(
      'md:hidden',
    );
    expect(screen.getAllByText('انگشتر آذر').length).toBeGreaterThan(0);
    expect(screen.queryByText('دستبند مهتاب')).not.toBeInTheDocument();
  });

  it('opens complete inventory alert details in a mobile bottom sheet', async () => {
    render(view());
    const alertRegion = screen.getByRole('region', { name: 'کارت‌های هشدار موجودی' });
    fireEvent.click(within(alertRegion).getByRole('button', { name: 'مشاهده جزئیات و عملیات' }));
    const dialog = await screen.findByRole('dialog', { name: 'انگشتر آذر' });
    expect(within(dialog).getByText('موجودی واقعی')).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: 'اصلاح موجودی این انبار' })).toHaveAttribute(
      'href',
      '/inventory?warehouse=warehouse-1',
    );
  });

  it('keeps store-wide demand visible when the warehouse list is unavailable', () => {
    render(
      view({ warehouses: [], inventory: [], selectedWarehouseId: null, warehousesFailed: true }),
    );
    expect(screen.getByText('فهرست انبارها از سرور دریافت نشد.')).toBeVisible();
    expect(screen.getByText('کم‌موجود').parentElement).toHaveTextContent('داده در دسترس نیست');
    expect(screen.getByText('درخواست منتظر').parentElement).toHaveTextContent('۳');
    expect(screen.getByRole('heading', { name: 'درخواست‌های اطلاع‌رسانی مشتریان' })).toBeVisible();
  });

  it('separates missing demand from a valid zero and describes a filter with no stock matches', () => {
    const { rerender } = render(view({ notifications: null, notificationsFailed: true }));
    expect(screen.getByText('درخواست منتظر').parentElement).toHaveTextContent('داده در دسترس نیست');
    rerender(
      view({
        notifications: { totals: { active: 0, queued: 0, notified: 0, cancelled: 0 }, targets: [] },
      }),
    );
    expect(screen.getByText('درخواست منتظر').parentElement).toHaveTextContent('۰');
    fireEvent.change(screen.getByRole('searchbox', { name: 'جستجوی هشدار موجودی' }), {
      target: { value: 'محصول خارج از فیلتر' },
    });
    expect(screen.getAllByText('هشداری با این فیلترها پیدا نشد').length).toBeGreaterThan(0);
    expect(screen.queryByText('هشدار موجودی ندارید')).toBeNull();
  });

  it('keeps notification demand readable without linking to product editing', () => {
    render(view({ canEditCatalog: false }));
    expect(screen.getByRole('heading', { name: 'درخواست‌های اطلاع‌رسانی مشتریان' })).toBeVisible();
    expect(screen.queryByRole('link', { name: 'مشاهده محصول' })).toBeNull();
  });
});
