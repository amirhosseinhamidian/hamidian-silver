import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SupplierBulkCrawlCard } from './supplier-bulk-crawl-card';
import type { AdminSupplierImportSource } from '@/lib/supplier-imports/supplier-imports-model';

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

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

const filters = {
  tab: 'BULK' as const,
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

const runPage = (items: readonly never[] = []) => ({
  items,
  total: items.length,
  page: 1,
  pageSize: 10,
  totalPages: 1,
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('SupplierBulkCrawlCard', () => {
  it('queues an archive continuation with the selected new-product limit', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'run-1' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    render(
      <SupplierBulkCrawlCard
        sources={[source]}
        categories={[
          {
            id: 'category-1',
            supplierSourceId: source.id,
            externalKey: '12',
            name: 'دستبند',
            url: 'https://bsjsilver.com/product/category/12-bracelet',
            catalogCategoryId: null,
            catalogCategoryName: null,
          },
        ]}
        runs={runPage()}
        archivedRuns={runPage()}
        filters={filters}
        canWrite
      />,
    );

    expect(screen.getByRole('combobox', { name: 'دسته‌بندی تأمین‌کننده' })).toHaveTextContent(
      'همه محصولات',
    );
    fireEvent.change(screen.getByLabelText('حداکثر محصول در هر اجرا'), {
      target: { value: '۲۵' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'شروع دریافت' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/supplier-imports/bulk-crawls',
      expect.objectContaining({
        body: JSON.stringify({
          supplierSourceId: source.id,
          limit: 25,
          stopAtKnown: false,
          resumeArchive: true,
          monitorKnownProducts: true,
        }),
      }),
    );
  });

  it('shows explicit live progress for an active crawl', () => {
    render(
      <SupplierBulkCrawlCard
        sources={[source]}
        categories={[]}
        runs={{
          ...runPage(),
          total: 1,
          items: [
            {
              id: 'run-1',
              supplierSourceId: source.id,
              sourceName: source.name,
              supplierName: source.supplierName,
              categoryName: 'گوشواره',
              isScheduled: false,
              scheduledCategoryIds: [],
              issues: [],
              status: 'RUNNING',
              requestedLimit: 100,
              currentPage: 2,
              discoveredCount: 28,
              succeededCount: 20,
              failedCount: 0,
              skippedCount: 8,
              stopAtKnown: false,
              monitorKnownProducts: true,
              errorMessage: null,
              archivedAt: null,
              archivedBy: null,
              createdAt: '2026-09-27T18:00:00.000Z',
            },
          ],
        }}
        archivedRuns={runPage()}
        filters={filters}
        canWrite
      />,
    );

    expect(screen.getByText(/پیشرفت نسبت به سقف انتخاب‌شده: ۲۸٪/)).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'پیشرفت دریافت گوشواره' })).toHaveAttribute(
      'aria-valuenow',
      '28',
    );
  });

  it('archives a reviewed finished crawl without approving its products', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'run-1', archived: true }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    render(
      <SupplierBulkCrawlCard
        sources={[source]}
        categories={[
          {
            id: 'category-1',
            supplierSourceId: source.id,
            externalKey: '12',
            name: 'دستبند نقره',
            url: 'https://bsjsilver.com/product/category/12-bracelet',
            catalogCategoryId: null,
            catalogCategoryName: null,
          },
        ]}
        runs={{
          ...runPage(),
          total: 1,
          items: [
            {
              id: 'run-1',
              supplierSourceId: source.id,
              sourceName: source.name,
              supplierName: source.supplierName,
              categoryName: null,
              isScheduled: true,
              scheduledCategoryIds: ['category-1'],
              issues: [],
              status: 'SUCCEEDED',
              requestedLimit: 25,
              currentPage: 2,
              discoveredCount: 25,
              succeededCount: 25,
              failedCount: 0,
              skippedCount: 0,
              stopAtKnown: false,
              monitorKnownProducts: true,
              errorMessage: null,
              archivedAt: null,
              archivedBy: null,
              createdAt: '2026-09-27T18:00:00.000Z',
            },
          ],
        }}
        archivedRuns={runPage()}
        filters={filters}
        canWrite
      />,
    );

    expect(screen.getByText(/بی‌اس‌جی · دستبند نقره/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'بررسی شد و انتقال به تاریخچه' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/supplier-imports/runs/run-1/archive',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
