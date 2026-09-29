import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SupplierCategoryMappingCard } from './supplier-category-mapping-card';
import { SupplierSourceChangesCard } from './supplier-source-changes-card';
import type {
  AdminSupplierImportSource,
  AdminSupplierSourceCategory,
  AdminSupplierSourceChange,
} from '@/lib/supplier-imports/supplier-imports-model';

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('@/components/ui/select', () => ({
  Select: ({
    'aria-label': ariaLabel,
    value,
    onValueChange,
    options,
    disabled,
  }: {
    'aria-label': string;
    value: string;
    onValueChange: (value: string) => void;
    options: readonly { value: string; label: string }[];
    disabled?: boolean;
  }) => (
    <select
      aria-label={ariaLabel}
      value={value}
      disabled={disabled}
      onChange={(event) => onValueChange(event.target.value)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}));

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

const source: AdminSupplierImportSource = {
  id: 'source-1',
  name: 'سایت اصلی',
  baseUrl: 'https://bsjsilver.com/',
  hostname: 'bsjsilver.com',
  adapterKey: 'bsj-silver',
  supplierName: 'بی‌اس‌جی',
  supplierCode: 'BSJ',
  supported: true,
  lastRunStatus: null,
  lastRunAt: null,
};

const category: AdminSupplierSourceCategory = {
  id: 'source-category-1',
  supplierSourceId: source.id,
  externalKey: '12',
  name: 'دستبند تأمین‌کننده',
  url: 'https://bsjsilver.com/product/category/12-bracelet',
  catalogCategoryId: null,
  catalogCategoryName: null,
};

const change: AdminSupplierSourceChange = {
  id: 'change-1',
  type: 'PRICE',
  previousValue: '1000000',
  newValue: '1200000',
  createdAt: '2026-09-28T10:00:00.000Z',
  draftId: 'draft-1',
  draftTitle: 'دستبند نقره',
  sourceUrl: 'https://bsjsilver.com/product/10611820-item',
  supplierName: 'بی‌اس‌جی',
  productId: 'product-1',
  productName: 'دستبند سایت',
};

describe('supplier crawl operations', () => {
  it('maps a supplier category to an internal catalog category', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <SupplierCategoryMappingCard
        sources={[source]}
        categories={[category]}
        catalogCategories={[{ id: 'catalog-1', name: 'دستبند نقره' }]}
        canWrite
      />,
    );

    fireEvent.change(screen.getByRole('combobox', { name: 'دسته داخلی برای دستبند تأمین‌کننده' }), {
      target: { value: 'catalog-1' },
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/supplier-imports/categories/source-category-1/mapping',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ catalogCategoryId: 'catalog-1' }),
      }),
    );
    expect(router.refresh).toHaveBeenCalled();
  });

  it('acknowledges a supplier price change without changing storefront price', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    render(<SupplierSourceChangesCard changes={[change]} canWrite />);

    expect(screen.getByText(/قیمت فروش سایت را تغییر نمی‌دهد/)).toBeInTheDocument();
    expect(screen.getByText(/از ۱٬۰۰۰٬۰۰۰ تومان به/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'بررسی شد' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/supplier-imports/changes/change-1/acknowledge',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(router.refresh).toHaveBeenCalled();
  });
});
