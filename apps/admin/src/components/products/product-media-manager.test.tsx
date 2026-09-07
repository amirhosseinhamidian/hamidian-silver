import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ProductMediaManager } from '@/components/products/product-media-manager';
import type { AdminProductMedia } from '@/lib/catalog/catalog-model';

const router = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock('next/navigation', () => ({ useRouter: () => router }));

afterEach(() => vi.unstubAllGlobals());

const media: readonly AdminProductMedia[] = [
  {
    id: '10000000-0000-4000-8000-000000000001',
    url: 'http://localhost:3000/media/catalog/front.webp',
    altText: 'نمای روبه‌رو',
    isPrimary: true,
    sortOrder: 0,
    mimeType: 'image/webp',
    originalName: 'front.webp',
    sizeBytes: 2048,
    width: null,
    height: null,
  },
  {
    id: '10000000-0000-4000-8000-000000000002',
    url: 'http://localhost:3000/media/catalog/side.webp',
    altText: 'نمای کنار',
    isPrimary: false,
    sortOrder: 1,
    mimeType: 'image/webp',
    originalName: 'side.webp',
    sizeBytes: 4096,
    width: null,
    height: null,
  },
];

function jsonResponse(body: unknown = { success: true }): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('ProductMediaManager', () => {
  it('shows gallery details in a bottom sheet and can select the primary image', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse());
    vi.stubGlobal('fetch', fetchMock);
    render(<ProductMediaManager productId="product-1" productName="انگشتر نقره" media={media} />);

    expect(screen.getByRole('heading', { name: 'تصاویر محصول' })).toBeInTheDocument();
    expect(screen.getByAltText('نمای روبه‌رو')).toBeInTheDocument();
    expect(screen.getByText('تصویر اصلی')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'جزئیات و ویرایش' })[1]);
    expect(await screen.findByRole('dialog', { name: 'تصویر ۲' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'انتخاب به‌عنوان اصلی' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/catalog/products/product-1/media/10000000-0000-4000-8000-000000000002',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ isPrimary: true }) }),
    );
    expect(router.refresh).toHaveBeenCalled();
  });

  it('uploads selected local files through the same-origin admin BFF', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 'media-1' }));
    vi.stubGlobal('fetch', fetchMock);
    render(<ProductMediaManager productId="product-1" productName="انگشتر نقره" media={[]} />);

    fireEvent.click(screen.getByRole('button', { name: 'افزودن تصویر' }));
    const input = await screen.findByLabelText(/انتخاب تصویر از دستگاه/);
    const file = new File(['image'], 'ring.webp', { type: 'image/webp' });
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: /بارگذاری ۱ تصویر/ }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(path).toBe('/api/catalog/products/product-1/media');
    expect(init.method).toBe('POST');
    expect(init.body).toBeInstanceOf(FormData);
    expect(router.refresh).toHaveBeenCalled();
  });
});
