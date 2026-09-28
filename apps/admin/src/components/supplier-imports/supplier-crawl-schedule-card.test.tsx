import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SupplierCrawlScheduleCard } from './supplier-crawl-schedule-card';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

const sources = [
  {
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
  },
] as const;

const categories = [
  {
    id: 'category-1',
    supplierSourceId: 'source-1',
    externalKey: '12',
    name: 'دستبند',
    url: 'https://bsjsilver.com/product/category/12-bracelet',
  },
] as const;

describe('SupplierCrawlScheduleCard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    refresh.mockReset();
  });

  it('saves a server-side crawl schedule with selected categories', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ id: 'schedule-1' }), { status: 200 }));
    render(
      <SupplierCrawlScheduleCard
        sources={sources}
        categories={categories}
        schedules={[]}
        canWrite
      />,
    );

    fireEvent.click(screen.getByLabelText('دستبند'));
    fireEvent.click(screen.getByRole('checkbox', { name: /زمان‌بندی فعال باشد/ }));
    fireEvent.click(screen.getByRole('button', { name: 'ذخیره زمان‌بندی' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/supplier-imports/schedules/source-1',
      expect.objectContaining({
        method: 'PATCH',
        body: expect.stringContaining('category-1'),
      }),
    );
    expect(await screen.findByText('زمان‌بندی ذخیره شد.')).toBeInTheDocument();
  });

  it('queues a saved schedule immediately', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ id: 'run-1' }), { status: 200 }));
    render(
      <SupplierCrawlScheduleCard
        sources={sources}
        categories={categories}
        schedules={[
          {
            id: 'schedule-1',
            supplierSourceId: 'source-1',
            categoryIds: [],
            isEnabled: true,
            timeOfDay: '02:00',
            timezone: 'Asia/Tehran',
            requestedLimit: 100,
            stopAtKnown: true,
            maxRetries: 2,
            retryDelayMinutes: 15,
            nextRunAt: '2026-09-29T22:30:00.000Z',
            lastEnqueuedAt: null,
            lastFinishedAt: null,
            lastRun: null,
          },
        ]}
        canWrite
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'اجرای همین حالا' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/supplier-imports/schedules/source-1/run-now',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
