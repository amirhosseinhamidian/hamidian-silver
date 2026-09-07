import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ProductForm } from '@/components/products/product-form';
import type { ProductFormData } from '@/lib/catalog/catalog-data';

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));

vi.mock('next/navigation', () => ({ useRouter: () => router }));

afterEach(() => vi.unstubAllGlobals());

const data: ProductFormData = {
  product: null,
  brands: [],
  countries: [],
  categories: [{ id: '10000000-0000-4000-8000-000000000001', name: 'انگشتر' }],
  sizes: [],
};

describe('ProductForm', () => {
  it('normalizes Persian price and weight digits before creating a product', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'product-1' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    render(<ProductForm data={data} mode="create" />);

    fireEvent.change(screen.getByLabelText(/نام محصول/), { target: { value: 'انگشتر نقره' } });
    fireEvent.change(screen.getByLabelText(/اسلاگ محصول/), { target: { value: 'silver-ring' } });
    fireEvent.change(screen.getByLabelText(/قیمت فروش/), { target: { value: '۴٬۵۰۰٬۰۰۰' } });
    fireEvent.change(screen.getByLabelText(/SKU اولیه/), { target: { value: 'RING-۰۰۱' } });
    fireEvent.change(screen.getByLabelText(/وزن به گرم/), { target: { value: '۴٫۲۵' } });
    fireEvent.click(screen.getByLabelText('انگشتر'));
    fireEvent.click(screen.getByRole('button', { name: 'ساخت محصول' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toMatchObject({
      name: 'انگشتر نقره',
      salePriceToman: 4_500_000,
      categoryIds: ['10000000-0000-4000-8000-000000000001'],
      sizeMode: 'NONE',
      variants: [{ sku: 'RING-۰۰۱', weightGrams: 4.25 }],
    });
    expect(router.push).toHaveBeenCalledWith('/products');
  });
});
