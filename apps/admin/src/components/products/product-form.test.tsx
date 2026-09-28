import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ProductForm } from '@/components/products/product-form';
import type { ProductFormData } from '@/lib/catalog/catalog-data';
import type { AdminSupplierImportDraft } from '@/lib/supplier-imports/supplier-imports-model';

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));

vi.mock('next/navigation', () => ({ useRouter: () => router }));

afterEach(() => vi.unstubAllGlobals());

const data: ProductFormData = {
  product: null,
  brands: [],
  countries: [],
  categories: [{ id: '10000000-0000-4000-8000-000000000001', name: 'انگشتر' }],
  sizes: [],
  sizeGroups: [],
};

const importDraft: AdminSupplierImportDraft = {
  id: '10000000-0000-4000-8000-000000000020',
  sourceProductKey: '10611820',
  sourceUrl: 'https://bsjsilver.com/product/10611820-item',
  sourceSku: '10611820',
  title: 'دستبند نقره رودیوم',
  description: 'توضیحات دریافت‌شده',
  sourceCategory: 'دستبند',
  supplierRetailPriceToman: 24_638_000,
  weightGrams: 13.78,
  attributes: [{ key: 'نوع آبکاری', value: 'رودیوم' }],
  imageUrls: ['https://bsjsilver.com/images/item.jpg'],
  status: 'PENDING_REVIEW',
  product: null,
  importedAt: null,
  importedBy: null,
  lastCrawledAt: '2026-09-28T06:00:00.000Z',
  updatedAt: '2026-09-28T06:00:00.000Z',
  source: {
    id: '10000000-0000-4000-8000-000000000021',
    name: 'سایت اصلی',
    hostname: 'bsjsilver.com',
    supplierName: 'بی‌اس‌جی',
    supplierCode: 'BSJ',
  },
  reviewedBy: null,
};

describe('ProductForm', () => {
  it('prefills a supplier draft and links it when creating the catalog product', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(new Uint8Array([0xff, 0xd8, 0xff]), {
          status: 200,
          headers: { 'Content-Type': 'image/jpeg' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: '10000000-0000-4000-8000-000000000022' }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'product-1' }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);
    render(<ProductForm data={data} mode="create" importDraft={importDraft} />);

    expect(screen.getByLabelText(/نام محصول/)).toHaveValue('دستبند نقره رودیوم');
    expect(screen.getByLabelText(/اسلاگ محصول/)).toHaveValue('bsj-10611820');
    expect(screen.getByLabelText(/SKU تنوع ۱/)).toHaveValue('10611820');
    expect(screen.getByLabelText(/وزن تنوع ۱/)).toHaveValue('13.78');
    expect(screen.getByText(/۲۴۶۳۸۰۰۰ تومان/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('قیمت فروش پیش‌فرض'), {
      target: { value: '۳۰٬۰۰۰٬۰۰۰' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'ساخت محصول' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(fetchMock.mock.calls[0]?.[0]).toContain(`/drafts/${importDraft.id}/images/0/download`);
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/catalog/media');
    const [, init] = fetchMock.mock.calls[2] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toMatchObject({
      supplierImportDraftId: importDraft.id,
      name: importDraft.title,
      salePriceToman: 30_000_000,
      attributes: [{ key: 'نوع آبکاری', value: 'رودیوم', sortOrder: 1 }],
      media: [{ mediaId: '10000000-0000-4000-8000-000000000022', isPrimary: true }],
    });
  });

  it('uploads selected product images and includes them when creating the product', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: '10000000-0000-4000-8000-000000000010' }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: '10000000-0000-4000-8000-000000000011' }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'product-1' }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);
    render(<ProductForm data={data} mode="create" />);

    fireEvent.change(screen.getByLabelText(/نام محصول/), { target: { value: 'انگشتر نقره' } });
    fireEvent.change(screen.getByLabelText(/اسلاگ محصول/), { target: { value: 'silver-ring' } });
    fireEvent.change(screen.getByLabelText('قیمت فروش پیش‌فرض'), {
      target: { value: '۴٬۵۰۰٬۰۰۰' },
    });
    fireEvent.change(screen.getByLabelText(/SKU تنوع ۱/), { target: { value: 'RING-001' } });
    const front = new File(['front'], 'front.webp', { type: 'image/webp' });
    const side = new File(['side'], 'side.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('انتخاب تصاویر محصول از دستگاه'), {
      target: { files: [front, side] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'ساخت محصول' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/catalog/media');
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/catalog/media');
    const [path, init] = fetchMock.mock.calls[2] as [string, RequestInit];
    expect(path).toBe('/api/catalog/products');
    expect(JSON.parse(String(init.body))).toMatchObject({
      media: [
        {
          mediaId: '10000000-0000-4000-8000-000000000010',
          sortOrder: 0,
          isPrimary: true,
          altText: 'انگشتر نقره',
        },
        {
          mediaId: '10000000-0000-4000-8000-000000000011',
          sortOrder: 1,
          isPrimary: false,
          altText: 'انگشتر نقره',
        },
      ],
    });
    expect(router.push).toHaveBeenCalledWith('/variants/product-1');
  });

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
    fireEvent.change(screen.getByLabelText('قیمت فروش پیش‌فرض'), {
      target: { value: '۴٬۵۰۰٬۰۰۰' },
    });
    fireEvent.change(screen.getByLabelText(/SKU تنوع ۱/), { target: { value: 'RING-۰۰۱' } });
    fireEvent.change(screen.getByLabelText(/وزن تنوع ۱/), { target: { value: '۴٫۲۵' } });
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
    expect(router.push).toHaveBeenCalledWith('/variants/product-1');
  });

  it('searches related products with thumbnails and submits selected relations', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'product-1' }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ relatedProductIds: ['related-1'] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);
    render(
      <ProductForm
        data={{
          ...data,
          products: [
            {
              id: 'related-1',
              name: 'گردنبند ماه',
              slug: 'moon-necklace',
              skus: ['NECK-001'],
              thumbnailUrl: 'https://media.hamidian.shop/moon-necklace.webp',
              thumbnailAlt: 'گردنبند ماه',
            },
            {
              id: 'related-2',
              name: 'دستبند خورشید',
              slug: 'sun-bracelet',
              skus: ['BRACE-002'],
              thumbnailUrl: null,
              thumbnailAlt: null,
            },
          ],
          relatedProductIds: [],
        }}
        mode="create"
      />,
    );

    expect(screen.queryByText('گردنبند ماه')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('جست‌وجوی محصولات'), {
      target: { value: 'ماه' },
    });
    expect(screen.getByRole('img', { name: 'گردنبند ماه' })).toBeInTheDocument();
    expect(screen.getByText('NECK-001', { exact: false })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'افزودن گردنبند ماه به محصولات مرتبط' }));

    fireEvent.change(screen.getByLabelText(/نام محصول/), { target: { value: 'انگشتر نقره' } });
    fireEvent.change(screen.getByLabelText(/اسلاگ محصول/), { target: { value: 'silver-ring' } });
    fireEvent.change(screen.getByLabelText('قیمت فروش پیش‌فرض'), {
      target: { value: '۴٬۵۰۰٬۰۰۰' },
    });
    fireEvent.change(screen.getByLabelText(/SKU تنوع ۱/), { target: { value: 'RING-001' } });
    fireEvent.click(screen.getByRole('button', { name: 'ساخت محصول' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const [relationPath, relationInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(relationPath).toBe('/api/catalog/products/product-1/relations');
    expect(JSON.parse(String(relationInit.body))).toEqual({ relatedProductIds: ['related-1'] });
  });

  it('creates all product variants in one request', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'product-1' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    render(<ProductForm data={data} mode="create" />);

    fireEvent.change(screen.getByLabelText(/نام محصول/), { target: { value: 'گردنبند نقره' } });
    fireEvent.change(screen.getByLabelText(/اسلاگ محصول/), {
      target: { value: 'silver-necklace' },
    });
    fireEvent.change(screen.getByLabelText('قیمت فروش پیش‌فرض'), {
      target: { value: '۵٬۰۰۰٬۰۰۰' },
    });
    fireEvent.change(screen.getByLabelText(/SKU تنوع ۱/), { target: { value: 'NECKLACE-A' } });
    fireEvent.change(screen.getByLabelText(/نام تنوع ۱/), { target: { value: 'مدل نقره‌ای' } });
    fireEvent.click(screen.getByRole('button', { name: 'افزودن تنوع' }));
    fireEvent.change(screen.getByLabelText(/SKU تنوع ۲/), { target: { value: 'NECKLACE-B' } });
    fireEvent.change(screen.getByLabelText(/نام تنوع ۲/), { target: { value: 'مدل طلایی' } });
    fireEvent.click(screen.getByRole('button', { name: 'ساخت محصول' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body)).variants).toEqual([
      { sku: 'NECKLACE-A', name: 'مدل نقره‌ای', isActive: true },
      { sku: 'NECKLACE-B', name: 'مدل طلایی', isActive: true },
    ]);
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
    fireEvent.change(screen.getByLabelText('قیمت فروش پیش‌فرض'), {
      target: { value: '۴٬۵۰۰٬۰۰۰' },
    });
    fireEvent.change(screen.getByLabelText(/SKU تنوع ۱/), { target: { value: 'RING-001' } });
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

  it('rejects product short descriptions longer than seven words', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<ProductForm data={data} mode="create" />);

    fireEvent.change(screen.getByLabelText(/نام محصول/), { target: { value: 'انگشتر نقره' } });
    fireEvent.change(screen.getByLabelText(/اسلاگ محصول/), { target: { value: 'silver-ring' } });
    fireEvent.change(screen.getByLabelText('توضیح کوتاه'), {
      target: { value: 'طراحی ظریف نقره با فرم مدرن برای استایل روزمره' },
    });
    fireEvent.change(screen.getByLabelText(/SKU تنوع ۱/), { target: { value: 'RING-001' } });
    fireEvent.click(screen.getByRole('button', { name: 'ساخت محصول' }));

    expect(screen.getByText('توضیح کوتاه محصول حداکثر باید ۷ واژه باشد.')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects duplicate custom attribute keys before calling the API', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<ProductForm data={data} mode="create" />);

    fireEvent.change(screen.getByLabelText(/نام محصول/), { target: { value: 'انگشتر نقره' } });
    fireEvent.change(screen.getByLabelText(/اسلاگ محصول/), { target: { value: 'silver-ring' } });
    fireEvent.change(screen.getByLabelText(/SKU تنوع ۱/), { target: { value: 'RING-001' } });
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
