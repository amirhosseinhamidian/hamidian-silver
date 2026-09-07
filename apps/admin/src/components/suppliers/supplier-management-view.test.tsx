import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SupplierManagementView } from '@/components/suppliers/supplier-management-view';
import type { AdminSupplier, AdminSupplierProduct } from '@/lib/suppliers/suppliers-model';

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

const supplier: AdminSupplier = {
  id: 'supplier-1',
  code: 'SUP-01',
  name: 'نقره‌سازی پارس',
  contactName: 'علی رضایی',
  phone: '09121234567',
  active: true,
  createdAt: '2026-09-07T09:00:00.000Z',
  updatedAt: '2026-09-07T10:00:00.000Z',
};

const product: AdminSupplierProduct = {
  id: 'product-1',
  name: 'انگشتر آذر',
  slug: 'azar-ring',
  status: 'ACTIVE',
  salePriceToman: 1_200_000,
  suppliers: [
    {
      supplierId: supplier.id,
      supplierName: supplier.name,
      supplierCode: supplier.code,
      supplierActive: true,
      supplierPriceToman: 800_000,
      markupPercent: 25,
      preferred: true,
      active: true,
      updatedAt: '2026-09-07T10:00:00.000Z',
    },
  ],
};

function view(canWrite = true) {
  return (
    <SupplierManagementView
      suppliers={[supplier]}
      products={[product]}
      failed={false}
      canWrite={canWrite}
    />
  );
}

describe('SupplierManagementView', () => {
  it('renders operational desktop tables and compact mobile cards', () => {
    render(view());
    expect(screen.getByRole('region', { name: 'کارت‌های تأمین‌کننده' })).toHaveClass('md:hidden');
    expect(screen.getByRole('region', { name: 'کارت‌های منبع تأمین محصول' })).toHaveClass(
      'md:hidden',
    );
    expect(screen.getAllByText('نقره‌سازی پارس').length).toBeGreaterThan(0);
    expect(screen.getAllByText('۸۰۰٬۰۰۰ تومان').length).toBeGreaterThan(0);
  });

  it('normalizes Persian purchase price and updates the selected supplier', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    render(view());
    const productCards = screen.getByRole('region', { name: 'کارت‌های منبع تأمین محصول' });
    fireEvent.click(within(productCards).getByRole('button', { name: 'مشاهده جزئیات و عملیات' }));
    const dialog = await screen.findByRole('dialog', { name: 'انگشتر آذر' });
    fireEvent.change(within(dialog).getByLabelText(/^قیمت خرید/), {
      target: { value: '۹۰۰٬۰۰۰' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'ذخیره منبع تأمین' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/pricing/products/product-1/suppliers/supplier-1',
      expect.objectContaining({
        method: 'PUT',
        body: expect.stringContaining('"supplierPriceToman":900000'),
      }),
    );
    expect(router.refresh).toHaveBeenCalled();
  });

  it('hides mutation controls for read-only pricing users', async () => {
    render(view(false));
    expect(screen.queryByRole('button', { name: 'افزودن تأمین‌کننده' })).not.toBeInTheDocument();
    const supplierCards = screen.getByRole('region', { name: 'کارت‌های تأمین‌کننده' });
    fireEvent.click(within(supplierCards).getByRole('button', { name: 'مشاهده جزئیات و عملیات' }));
    const dialog = await screen.findByRole('dialog', { name: 'نقره‌سازی پارس' });
    expect(within(dialog).queryByRole('button', { name: 'ذخیره تغییرات' })).not.toBeInTheDocument();
    expect(within(dialog).getByText('مسئول ارتباط')).toBeInTheDocument();
  });
});
