import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ProductVariantManager } from '@/components/products/product-variant-manager';
import type { AdminProduct, CatalogSize } from '@/lib/catalog/catalog-model';

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

afterEach(() => vi.unstubAllGlobals());

const product: AdminProduct = {
  id: 'product-1',
  name: 'انگشتر نقره',
  slug: 'silver-ring',
  shortDescription: null,
  description: null,
  status: 'DRAFT',
  sizeMode: 'SIZED',
  salePriceToman: null,
  compareAtPriceToman: null,
  seoTitle: null,
  seoDescription: null,
  seoCanonicalPath: null,
  seoNoIndex: false,
  seoOgMediaId: null,
  seoOgMedia: null,
  createdAt: '2026-09-07T10:00:00.000Z',
  updatedAt: '2026-09-07T10:00:00.000Z',
  brand: null,
  country: null,
  categories: [],
  variants: [
    {
      id: 'variant-1',
      sku: 'RING-52',
      name: 'سایز ۵۲',
      weightGrams: 4.25,
      active: true,
      size: { id: 'size-1', label: 'سایز ۵۲' },
    },
  ],
  media: [],
  mediaCount: 0,
};

const sizes: readonly CatalogSize[] = [
  { id: 'size-1', code: '52', label: 'سایز ۵۲', sortOrder: 1, active: true },
];

function jsonResponse(body: unknown = { success: true }): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('ProductVariantManager', () => {
  it('uses compact mobile cards with an editable details bottom sheet', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse());
    vi.stubGlobal('fetch', fetchMock);
    render(<ProductVariantManager product={product} sizes={sizes} />);

    expect(screen.getByRole('region', { name: 'کارت‌های تنوع محصول' })).toHaveClass('md:hidden');
    fireEvent.click(screen.getAllByRole('button', { name: 'مشاهده جزئیات و عملیات' })[0]);
    const dialog = await screen.findByRole('dialog', { name: /تنوع RING-۵۲/ });
    fireEvent.change(within(dialog).getByLabelText(/وزن به گرم/), {
      target: { value: '۵٫۱۲۵' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'ذخیره تغییرات' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/catalog/products/product-1/variants/variant-1',
      expect.objectContaining({
        method: 'PATCH',
        body: expect.stringContaining('5.125'),
      }),
    );
    expect(router.refresh).toHaveBeenCalled();
  });

  it('creates catalog sizes with normalized Persian numeric input', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse());
    vi.stubGlobal('fetch', fetchMock);
    render(<ProductVariantManager product={product} sizes={sizes} />);

    fireEvent.click(screen.getByRole('button', { name: 'افزودن سایز' }));
    const dialog = await screen.findByRole('dialog', { name: 'افزودن سایز جدید' });
    fireEvent.change(within(dialog).getByLabelText(/کد سایز/), { target: { value: '54' } });
    fireEvent.change(within(dialog).getByLabelText(/عنوان نمایشی/), {
      target: { value: 'سایز ۵۴' },
    });
    fireEvent.change(within(dialog).getByLabelText(/ترتیب نمایش/), { target: { value: '۳' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'ذخیره سایز' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/catalog/sizes',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          code: '54',
          label: 'سایز ۵۴',
          sortOrder: 3,
          isActive: true,
        }),
      }),
    );
  });
});
