import type { ReactNode } from 'react';

import { Alert } from '@/components/ui/alert';
import { DataTable, type DataTableProps } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { RetryButton } from '@/components/ui/retry-button';
import { Skeleton } from '@/components/ui/skeleton';

type ResponsiveDataViewProps<Row> = DataTableProps<Row> &
  Readonly<{
    mobileLabel: string;
    renderMobileCard: (row: Row) => ReactNode;
    mobileLoadingCount?: number;
  }>;

export function ResponsiveDataView<Row>({
  mobileLabel,
  renderMobileCard,
  mobileLoadingCount = 4,
  footer,
  loading = false,
  error,
  emptyTitle = 'داده‌ای برای نمایش وجود ندارد',
  emptyDescription,
  emptyAction,
  rows,
  getRowKey,
  ...tableProps
}: ResponsiveDataViewProps<Row>) {
  return (
    <>
      <section aria-label={mobileLabel} className="md:hidden">
        {loading ? (
          <div className="grid gap-2" role="status" aria-label="در حال بارگذاری اطلاعات">
            {Array.from({ length: mobileLoadingCount }, (_, index) => (
              <div
                key={index}
                aria-hidden="true"
                className="rounded-[var(--admin-radius-lg)] border border-[var(--admin-color-border)] bg-[var(--admin-color-surface)] p-3"
              >
                <div className="flex justify-between gap-4">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
                <Skeleton className="mt-4 h-12 w-full" />
                <Skeleton className="mt-3 h-8 w-full" />
              </div>
            ))}
          </div>
        ) : error ? (
          <Alert
            tone="danger"
            title={error.title ?? 'دریافت اطلاعات ناموفق بود'}
            action={error.action ?? <RetryButton />}
          >
            {error.description}
          </Alert>
        ) : rows.length === 0 ? (
          <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
        ) : (
          <ul className="grid gap-2">
            {rows.map((row) => (
              <li key={getRowKey(row)}>{renderMobileCard(row)}</li>
            ))}
          </ul>
        )}
        {footer && !loading && !error && rows.length > 0 ? (
          <div className="mt-3 overflow-hidden rounded-[var(--admin-radius-lg)] border border-[var(--admin-color-border)] bg-[var(--admin-color-surface)]">
            {footer}
          </div>
        ) : null}
      </section>

      <div className="hidden md:block">
        <DataTable
          {...tableProps}
          rows={rows}
          getRowKey={getRowKey}
          loading={loading}
          error={error}
          emptyTitle={emptyTitle}
          emptyDescription={emptyDescription}
          emptyAction={emptyAction}
          footer={footer}
        />
      </div>
    </>
  );
}
