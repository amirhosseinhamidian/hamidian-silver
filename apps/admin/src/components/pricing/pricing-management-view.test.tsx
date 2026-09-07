import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PricingManagementView } from '@/components/pricing/pricing-management-view';
import type { AdminPricingCatalog } from '@/lib/pricing/pricing-model';

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

const catalog: AdminPricingCatalog = {
  products: [
    {
      id: 'product-1',
      name: 'انگشتر آذر',
      slug: 'azar-ring',
      status: 'ACTIVE',
      salePriceToman: 1_200_000,
      compareAtPriceToman: 1_500_000,
      supplierCostToman: 800_000,
      supplierName: 'نقره‌سازی پارس',
    },
  ],
  platingRates: [
    {
      id: 'rate-1',
      type: 'GOLD',
      pricePerGramToman: 250_000,
      leadTimeDays: 3,
      active: true,
      updatedAt: '2026-09-07T12:00:00.000Z',
    },
  ],
  history: [
    {
      id: 'history-1',
      kind: 'PRODUCT',
      title: 'انگشتر آذر',
      previousPriceToman: 1_100_000,
      newPriceToman: 1_200_000,
      previousCompareAtPriceToman: null,
      newCompareAtPriceToman: 1_500_000,
      previousLeadTimeDays: null,
      newLeadTimeDays: null,
      reason: 'به‌روزرسانی قیمت',
      actor: 'مدیر فروش',
      createdAt: '2026-09-07T12:00:00.000Z',
    },
  ],
};

describe('PricingManagementView', () => {
  it('renders the pricing chart, desktop tables and mobile cards', () => {
    render(<PricingManagementView catalog={catalog} failed={false} canWrite />);
    expect(screen.getByRole('img', { name: /پوشش قیمت‌گذاری محصولات/ })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'کارت‌های قیمت محصول' })).toHaveClass('md:hidden');
    expect(screen.getByRole('region', { name: 'کارت‌های تاریخچه قیمت' })).toHaveClass('md:hidden');
    expect(screen.getAllByText('۱٬۲۰۰٬۰۰۰ تومان').length).toBeGreaterThan(0);
  });

  it('normalizes Persian prices and sends compare-at price with an audit reason', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    render(<PricingManagementView catalog={catalog} failed={false} canWrite />);
    const mobileProducts = screen.getByRole('region', { name: 'کارت‌های قیمت محصول' });
    fireEvent.click(within(mobileProducts).getByRole('button', { name: 'مشاهده جزئیات و عملیات' }));
    const dialog = await screen.findByRole('dialog', { name: 'انگشتر آذر' });
    fireEvent.change(within(dialog).getByLabelText(/^قیمت فروش/), {
      target: { value: '۱٬۳۰۰٬۰۰۰' },
    });
    fireEvent.change(within(dialog).getByLabelText(/^قیمت قبل از تخفیف/), {
      target: { value: '۱٬۶۰۰٬۰۰۰' },
    });
    fireEvent.change(within(dialog).getByLabelText(/^دلیل تغییر/), {
      target: { value: 'اصلاح قیمت روز' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'ذخیره قیمت' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/pricing/products/product-1/sale-price',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          salePriceToman: 1_300_000,
          compareAtPriceToman: 1_600_000,
          reason: 'اصلاح قیمت روز',
        }),
      }),
    );
    expect(router.refresh).toHaveBeenCalled();
  });

  it('provides read-only details without mutation actions', async () => {
    render(<PricingManagementView catalog={catalog} failed={false} canWrite={false} />);
    expect(screen.queryByRole('link', { name: 'مدیریت نرخ و گزینه‌ها' })).not.toBeInTheDocument();
    const mobileProducts = screen.getByRole('region', { name: 'کارت‌های قیمت محصول' });
    fireEvent.click(within(mobileProducts).getByRole('button', { name: 'مشاهده جزئیات و عملیات' }));
    const dialog = await screen.findByRole('dialog', { name: 'انگشتر آذر' });
    expect(within(dialog).queryByRole('button', { name: 'ذخیره قیمت' })).not.toBeInTheDocument();
    expect(within(dialog).getByText('حاشیه ناخالص')).toBeInTheDocument();
  });
});
