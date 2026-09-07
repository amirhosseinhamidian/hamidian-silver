import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ReferenceManagementView } from '@/components/catalog-references/reference-management-view';
import type { AdminBrand, AdminCountry } from '@/lib/catalog/catalog-model';

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

const brand: AdminBrand = {
  id: 'brand-1',
  name: 'حمیدیان',
  slug: 'hamidian',
  description: 'برند نقره',
  active: true,
  productCount: 3,
  image: null,
  createdAt: '2026-09-07T10:00:00.000Z',
  updatedAt: '2026-09-07T11:00:00.000Z',
};

const country: AdminCountry = {
  id: 'country-1',
  name: 'ایران',
  slug: 'iran',
  isoCode: 'IR',
  description: 'ساخت ایران',
  active: true,
  productCount: 2,
  image: null,
  createdAt: '2026-09-07T10:00:00.000Z',
  updatedAt: '2026-09-07T11:00:00.000Z',
};

function view(canWrite = true) {
  return (
    <ReferenceManagementView
      brands={[brand]}
      countries={[country]}
      brandsFailed={false}
      countriesFailed={false}
      canWrite={canWrite}
    />
  );
}

describe('ReferenceManagementView', () => {
  it('switches between responsive brand and country views', () => {
    render(view());
    expect(screen.getByRole('region', { name: 'کارت‌های برندها' })).toHaveClass('md:hidden');
    fireEvent.click(screen.getByRole('tab', { name: /کشورها/ }));
    expect(screen.getByRole('region', { name: 'کارت‌های کشورها' })).toHaveClass('md:hidden');
    expect(screen.getAllByText('IR').length).toBeGreaterThan(0);
  });

  it('creates a country and normalizes its ISO code', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'country-2' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    render(view());
    fireEvent.click(screen.getByRole('tab', { name: /کشورها/ }));
    fireEvent.click(screen.getByRole('button', { name: 'افزودن کشور' }));
    const dialog = await screen.findByRole('dialog', { name: 'افزودن کشور' });
    fireEvent.change(within(dialog).getByLabelText(/نام کشور/), { target: { value: 'ترکیه' } });
    fireEvent.change(within(dialog).getByLabelText(/اسلاگ/), { target: { value: 'turkey' } });
    fireEvent.change(within(dialog).getByLabelText(/کد دوحرفی/), { target: { value: 'tr' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'ذخیره کشور' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/catalog/countries',
      expect.objectContaining({ method: 'POST', body: expect.stringContaining('"isoCode":"TR"') }),
    );
    expect(router.refresh).toHaveBeenCalled();
  });

  it('hides mutation controls for read-only users', () => {
    render(view(false));
    expect(screen.queryByRole('button', { name: 'افزودن برند' })).not.toBeInTheDocument();
    expect(screen.getByText('فقط مشاهده')).toBeInTheDocument();
  });
});
