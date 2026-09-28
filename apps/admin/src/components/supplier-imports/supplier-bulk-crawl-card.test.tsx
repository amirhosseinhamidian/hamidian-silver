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

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('SupplierBulkCrawlCard', () => {
  it('queues an initial catalog crawl with the selected new-product limit', async () => {
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
          },
        ]}
        runs={[]}
        canWrite
      />,
    );

    expect(screen.getByRole('combobox', { name: 'دسته‌بندی تأمین‌کننده' })).toHaveTextContent(
      'همه محصولات',
    );
    fireEvent.change(screen.getByLabelText('حداکثر محصولات جدید'), {
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
        }),
      }),
    );
  });

  it('shows explicit live progress for an active crawl', () => {
    render(
      <SupplierBulkCrawlCard
        sources={[source]}
        categories={[]}
        runs={[
          {
            id: 'run-1',
            supplierSourceId: source.id,
            sourceName: source.name,
            supplierName: source.supplierName,
            categoryName: 'گوشواره',
            status: 'RUNNING',
            requestedLimit: 100,
            currentPage: 2,
            discoveredCount: 28,
            succeededCount: 20,
            failedCount: 0,
            skippedCount: 8,
            stopAtKnown: false,
            errorMessage: null,
            createdAt: '2026-09-27T18:00:00.000Z',
          },
        ]}
        canWrite
      />,
    );

    expect(screen.getByText(/پیشرفت: ۲۰٪/)).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'پیشرفت دریافت گوشواره' })).toHaveAttribute(
      'aria-valuenow',
      '20',
    );
  });
});
