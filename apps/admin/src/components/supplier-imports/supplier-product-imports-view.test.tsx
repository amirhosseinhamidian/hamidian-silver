import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SupplierProductImportsView } from './supplier-product-imports-view';
import type {
  AdminSupplierImportDraft,
  AdminSupplierImportSource,
} from '@/lib/supplier-imports/supplier-imports-model';

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

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

const draft: AdminSupplierImportDraft = {
  id: 'draft-1',
  sourceProductKey: '10611820',
  sourceUrl: 'https://bsjsilver.com/product/10611820-item',
  sourceSku: '10611820',
  title: 'دستبند نقره',
  description: 'توضیحات تأمین‌کننده',
  sourceCategory: 'دستبند',
  supplierRetailPriceToman: 24_638_000,
  sourceAvailability: 'IN_STOCK',
  catalogCategoryId: null,
  weightGrams: 13.78,
  attributes: [{ key: 'نوع آبکاری', value: 'رادیوم' }],
  imageUrls: ['https://bsjsilver.com/images/item.jpg'],
  status: 'PENDING_REVIEW',
  product: null,
  importedAt: null,
  importedBy: null,
  lastCrawledAt: '2026-09-27T10:00:00.000Z',
  updatedAt: '2026-09-27T10:00:00.000Z',
  source: {
    id: 'source-1',
    name: 'سایت اصلی',
    hostname: 'bsjsilver.com',
    supplierName: 'بی‌اس‌جی',
    supplierCode: 'BSJ',
  },
  reviewedBy: null,
};

const filters = {
  tab: 'DRAFTS' as const,
  status: 'ALL' as const,
  supplierSourceId: 'ALL' as const,
  page: 1,
  pageSize: 24,
  runPage: 1,
  runPageSize: 10,
  historyPage: 1,
  historyPageSize: 10,
  showHistory: false,
  changePage: 1,
  changePageSize: 20,
};

const runPage = { items: [], total: 0, page: 1, pageSize: 10, totalPages: 1 } as const;
const draftPage = (items: readonly AdminSupplierImportDraft[]) => ({
  items,
  total: items.length,
  page: 1,
  pageSize: 24,
  totalPages: 1,
});

describe('SupplierProductImportsView', () => {
  it('starts a manual crawl for the selected dynamic supplier source', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ draft: { id: 'draft-2' } }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    render(
      <SupplierProductImportsView
        sources={[source]}
        drafts={draftPage([])}
        categories={[]}
        runs={runPage}
        archivedRuns={runPage}
        filters={filters}
        failed={false}
        canWrite
      />,
    );

    fireEvent.change(screen.getByLabelText('نشانی صفحه محصول'), {
      target: { value: draft.sourceUrl },
    });
    fireEvent.click(screen.getByRole('button', { name: 'دریافت محصول' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/supplier-imports/crawl',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ supplierSourceId: source.id, targetUrl: draft.sourceUrl }),
      }),
    );
    expect(await screen.findByText(/برای بازبینی در فهرست قرار گرفت/)).toBeInTheDocument();
    expect(router.refresh).toHaveBeenCalled();
  });

  it('shows supplier retail data and saves reviewed draft edits', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: draft.id }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    render(
      <SupplierProductImportsView
        sources={[source]}
        drafts={draftPage([draft])}
        categories={[]}
        runs={runPage}
        archivedRuns={runPage}
        filters={filters}
        failed={false}
        canWrite
      />,
    );

    expect(screen.getByText('۲۴٬۶۳۸٬۰۰۰ تومان')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'دانلود تصویر ۱' })).toHaveAttribute(
      'href',
      '/api/supplier-imports/drafts/draft-1/images/0/download',
    );
    fireEvent.click(screen.getByRole('button', { name: 'بازبینی و ویرایش' }));
    const dialog = await screen.findByRole('dialog', { name: 'بازبینی محصول دریافتی' });
    fireEvent.change(within(dialog).getByLabelText(/^عنوان محصول/), {
      target: { value: 'دستبند نقره ویرایش‌شده' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'ذخیره بازبینی' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/supplier-imports/drafts/draft-1',
      expect.objectContaining({
        method: 'PATCH',
        body: expect.stringContaining('دستبند نقره ویرایش‌شده'),
      }),
    );
  });
});
