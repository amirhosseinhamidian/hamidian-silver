import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CategoryManagementView } from '@/components/categories/category-management-view';
import type { AdminCategory } from '@/lib/catalog/catalog-model';

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

const categories: readonly AdminCategory[] = [
  {
    id: 'category-1',
    name: 'انگشتر',
    slug: 'rings',
    description: 'انواع انگشتر نقره',
    sortOrder: 1,
    active: true,
    createdAt: '2026-09-07T10:00:00.000Z',
    updatedAt: '2026-09-07T11:00:00.000Z',
    parent: null,
    parentId: null,
    image: null,
    childCount: 0,
    productCount: 2,
  },
];

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('CategoryManagementView', () => {
  it('uses mobile cards and normalizes Persian order input when editing', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 'category-1' }));
    vi.stubGlobal('fetch', fetchMock);
    render(<CategoryManagementView categories={categories} failed={false} canWrite />);

    expect(screen.getByRole('region', { name: 'کارت‌های دسته‌بندی' })).toHaveClass('md:hidden');
    fireEvent.click(screen.getByRole('button', { name: 'مشاهده جزئیات و عملیات' }));
    const dialog = await screen.findByRole('dialog', { name: 'انگشتر' });
    fireEvent.change(within(dialog).getByLabelText(/ترتیب نمایش/), { target: { value: '۳' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'ذخیره تغییرات' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/catalog/categories/category-1',
      expect.objectContaining({ method: 'PATCH', body: expect.stringContaining('"sortOrder":3') }),
    );
    expect(router.refresh).toHaveBeenCalled();
  });

  it('creates a category then uploads its image through the same-origin BFF', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ id: 'category-2' }))
      .mockResolvedValueOnce(jsonResponse({ image: { id: 'media-1' } }));
    vi.stubGlobal('fetch', fetchMock);
    render(<CategoryManagementView categories={categories} failed={false} canWrite />);

    fireEvent.click(screen.getByRole('button', { name: 'افزودن دسته' }));
    const dialog = await screen.findByRole('dialog', { name: 'افزودن دسته‌بندی' });
    fireEvent.change(within(dialog).getByLabelText(/نام دسته‌بندی/), {
      target: { value: 'گردنبند' },
    });
    fireEvent.change(within(dialog).getByLabelText(/اسلاگ/), {
      target: { value: 'necklaces' },
    });
    const image = new File(['image'], 'necklace.webp', { type: 'image/webp' });
    fireEvent.change(within(dialog).getByLabelText('تصویر Hero دسته‌بندی'), {
      target: { files: [image] },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'ذخیره دسته‌بندی' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[0][0]).toBe('/api/catalog/categories');
    expect(fetchMock.mock.calls[1][0]).toBe('/api/catalog/categories/category-2/image');
    expect((fetchMock.mock.calls[1][1] as RequestInit).body).toBeInstanceOf(FormData);
  });

  it('keeps mutation controls hidden for read-only catalog users', () => {
    render(<CategoryManagementView categories={categories} failed={false} canWrite={false} />);
    expect(screen.queryByRole('button', { name: 'افزودن دسته' })).not.toBeInTheDocument();
    expect(screen.getByText('فقط مشاهده')).toBeInTheDocument();
  });
});
