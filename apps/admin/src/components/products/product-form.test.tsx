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

  it('adds, reorders and submits custom product attributes with explicit display order', async () => {
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
    fireEvent.change(screen.getByLabelText(/SKU اولیه/), { target: { value: 'RING-001' } });
    fireEvent.click(screen.getByRole('button', { name: 'افزودن ویژگی' }));
    fireEvent.click(screen.getByRole('button', { name: 'افزودن ویژگی' }));
    fireEvent.change(screen.getByLabelText(/کلید ویژگی ۱/), {
      target: { value: 'جنس نگین' },
    });
    fireEvent.change(screen.getByLabelText(/مقدار ویژگی ۱/), {
      target: { value: 'زیرکونیا' },
    });
    fireEvent.change(screen.getByLabelText(/کلید ویژگی ۲/), {
      target: { value: 'نوع آبکاری' },
    });
    fireEvent.change(screen.getByLabelText(/مقدار ویژگی ۲/), {
      target: { value: 'رودیوم' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'انتقال ویژگی ۲ به بالا' }));
    fireEvent.click(screen.getByRole('button', { name: 'ساخت محصول' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body)).attributes).toEqual([
      { key: 'نوع آبکاری', value: 'رودیوم', sortOrder: 1 },
      { key: 'جنس نگین', value: 'زیرکونیا', sortOrder: 2 },
    ]);
  });

  it('rejects duplicate custom attribute keys before calling the API', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<ProductForm data={data} mode="create" />);

    fireEvent.change(screen.getByLabelText(/نام محصول/), { target: { value: 'انگشتر نقره' } });
    fireEvent.change(screen.getByLabelText(/اسلاگ محصول/), { target: { value: 'silver-ring' } });
    fireEvent.change(screen.getByLabelText(/SKU اولیه/), { target: { value: 'RING-001' } });
    fireEvent.click(screen.getByRole('button', { name: 'افزودن ویژگی' }));
    fireEvent.click(screen.getByRole('button', { name: 'افزودن ویژگی' }));
    for (const input of screen.getAllByLabelText(/کلید ویژگی/)) {
      fireEvent.change(input, { target: { value: 'جنس نگین' } });
    }
    for (const input of screen.getAllByLabelText(/مقدار ویژگی/)) {
      fireEvent.change(input, { target: { value: 'زیرکونیا' } });
    }
    fireEvent.click(screen.getByRole('button', { name: 'ساخت محصول' }));

    expect(screen.getByText('کلید ویژگی‌های محصول نباید تکراری باشد.')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
