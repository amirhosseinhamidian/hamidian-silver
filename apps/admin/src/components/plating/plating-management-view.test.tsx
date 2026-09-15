import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PlatingManagementView } from '@/components/plating/plating-management-view';
import type { AdminPlatingRate, AdminPlatingVariant } from '@/lib/plating/plating-model';

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

const rates: readonly AdminPlatingRate[] = [
  {
    id: 'rate-gold',
    type: 'GOLD',
    pricePerGramToman: 50_000,
    leadTimeDays: 3,
    active: true,
    createdAt: '2026-09-07T10:00:00.000Z',
    updatedAt: '2026-09-07T11:00:00.000Z',
  },
  {
    id: 'rate-rhodium',
    type: 'RHODIUM',
    pricePerGramToman: 30_000,
    leadTimeDays: 2,
    active: true,
    createdAt: '2026-09-07T10:00:00.000Z',
    updatedAt: '2026-09-07T11:00:00.000Z',
  },
];

const variant: AdminPlatingVariant = {
  id: 'variant-1',
  productId: 'product-1',
  productName: 'انگشتر آذر',
  productSlug: 'azar-ring',
  productStatus: 'ACTIVE',
  sku: 'RING-52',
  name: 'سایز ۵۲',
  sizeLabel: '۵۲',
  weightGrams: 4,
  active: true,
  eligible: true,
  options: [],
};

function jsonResponse(body: unknown = { success: true }): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function view(overrides: Partial<React.ComponentProps<typeof PlatingManagementView>> = {}) {
  return (
    <PlatingManagementView
      rates={rates}
      variants={[variant]}
      ratesFailed={false}
      variantsFailed={false}
      canWritePricing
      canWriteCatalog
      {...overrides}
    />
  );
}

describe('PlatingManagementView', () => {
  it('renders operational rates and mobile variant cards', () => {
    render(view());
    expect(screen.getByRole('region', { name: 'کارت‌های تنظیمات آبکاری' })).toHaveClass(
      'md:hidden',
    );
    expect(screen.getByText('۵۰٬۰۰۰ تومان')).toBeInTheDocument();
    expect(screen.getAllByText('انگشتر آذر').length).toBeGreaterThan(0);
  });

  it('normalizes Persian rate values and records the change reason', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse());
    vi.stubGlobal('fetch', fetchMock);
    render(view());
    fireEvent.click(screen.getAllByRole('button', { name: 'ویرایش نرخ' })[0]);
    const dialog = await screen.findByRole('dialog', { name: 'آبکاری طلا' });
    fireEvent.change(within(dialog).getByLabelText(/نرخ هر گرم/), {
      target: { value: '۶۰٬۰۰۰' },
    });
    fireEvent.change(within(dialog).getByLabelText(/زمان آماده‌سازی/), {
      target: { value: '۴' },
    });
    fireEvent.change(within(dialog).getByLabelText(/دلیل تغییر/), {
      target: { value: 'تغییر نرخ تأمین‌کننده' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'ذخیره نرخ' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/plating/rates/GOLD',
      expect.objectContaining({
        method: 'PUT',
        body: expect.stringContaining('"pricePerGramToman":60000'),
      }),
    );
    expect(router.refresh).toHaveBeenCalled();
  });

  it('updates weight and enables a plating option from the mobile bottom sheet', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse());
    vi.stubGlobal('fetch', fetchMock);
    render(view());
    fireEvent.click(screen.getByRole('button', { name: 'مشاهده جزئیات و عملیات' }));
    const dialog = await screen.findByRole('dialog', { name: 'انگشتر آذر' });
    fireEvent.change(within(dialog).getByLabelText(/وزن مبنای آبکاری/), {
      target: { value: '۴٫۲۵۰' },
    });
    fireEvent.click(within(dialog).getByLabelText(/^آبکاری طلا/));
    fireEvent.click(within(dialog).getByRole('button', { name: 'ذخیره تغییرات' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[0][0]).toBe('/api/catalog/products/product-1/variants/variant-1');
    expect(fetchMock.mock.calls[1][0]).toBe('/api/plating/variants/variant-1/options/GOLD');
    expect(router.refresh).toHaveBeenCalled();
  });

  it('keeps rate mutations hidden for read-only pricing users', () => {
    render(view({ canWritePricing: false, canWriteCatalog: false }));
    expect(screen.queryByRole('button', { name: 'ویرایش نرخ' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'مشاهده جزئیات' }).length).toBeGreaterThan(0);
  });
});
