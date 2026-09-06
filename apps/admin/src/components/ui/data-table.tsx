import type { ReactNode } from 'react';

import { Alert } from '@/components/ui/alert';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/ui/cn';

type ColumnVisibility = 'always' | 'sm' | 'md' | 'lg';
type ColumnAlign = 'start' | 'center' | 'end';

const visibilityClassNames: Record<ColumnVisibility, string> = {
  always: '',
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
};

const alignClassNames: Record<ColumnAlign, string> = {
  start: 'text-start',
  center: 'text-center',
  end: 'text-end',
};

export type DataTableColumn<Row> = Readonly<{
  id: string;
  header: ReactNode;
  cell: (row: Row) => ReactNode;
  visibility?: ColumnVisibility;
  align?: ColumnAlign;
  className?: string;
  headerClassName?: string;
}>;

type DataTableProps<Row> = Readonly<{
  caption: string;
  columns: readonly DataTableColumn<Row>[];
  rows: readonly Row[];
  getRowKey: (row: Row) => string;
  loading?: boolean;
  loadingRowCount?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  error?: Readonly<{ title?: string; description: ReactNode; action?: ReactNode }>;
  footer?: ReactNode;
  stickyHeader?: boolean;
  compact?: boolean;
  getRowClassName?: (row: Row) => string | undefined;
}>;

export function DataTable<Row>({
  caption,
  columns,
  rows,
  getRowKey,
  loading = false,
  loadingRowCount = 5,
  emptyTitle = 'داده‌ای برای نمایش وجود ندارد',
  emptyDescription,
  emptyAction,
  error,
  footer,
  stickyHeader = false,
  compact = false,
  getRowClassName,
}: DataTableProps<Row>) {
  return (
    <div className="overflow-hidden rounded-[var(--admin-radius-lg)] border border-[var(--admin-color-border)] bg-[var(--admin-color-surface)] shadow-[var(--admin-shadow-sm)]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[48rem] border-collapse text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead
            className={cn(
              'bg-[var(--admin-color-surface-subtle)] text-xs font-bold text-[var(--admin-color-muted)]',
              stickyHeader && 'sticky top-0 z-10 shadow-[0_1px_0_var(--admin-color-border)]',
            )}
          >
            <tr>
              {columns.map((column) => (
                <th
                  key={column.id}
                  scope="col"
                  className={cn(
                    'whitespace-nowrap border-b border-[var(--admin-color-border)] px-4 py-3',
                    visibilityClassNames[column.visibility ?? 'always'],
                    alignClassNames[column.align ?? 'start'],
                    column.headerClassName,
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--admin-color-border)]">
            {loading
              ? Array.from({ length: loadingRowCount }, (_, rowIndex) => (
                  <tr key={`loading-${rowIndex}`} aria-hidden="true">
                    {columns.map((column) => (
                      <td
                        key={column.id}
                        className={cn(
                          'px-4',
                          compact ? 'py-2.5' : 'py-3.5',
                          visibilityClassNames[column.visibility ?? 'always'],
                        )}
                      >
                        <Skeleton className="h-4 w-3/4" />
                      </td>
                    ))}
                  </tr>
                ))
              : error
                ? null
                : rows.map((row) => (
                    <tr
                      key={getRowKey(row)}
                      className={cn(
                        'transition-colors hover:bg-[var(--admin-color-surface-subtle)]',
                        getRowClassName?.(row),
                      )}
                    >
                      {columns.map((column) => (
                        <td
                          key={column.id}
                          className={cn(
                            'px-4 text-[var(--admin-color-ink)]',
                            compact ? 'py-2.5' : 'py-3.5',
                            visibilityClassNames[column.visibility ?? 'always'],
                            alignClassNames[column.align ?? 'start'],
                            column.className,
                          )}
                        >
                          {column.cell(row)}
                        </td>
                      ))}
                    </tr>
                  ))}
          </tbody>
        </table>
      </div>

      {loading ? (
        <p role="status" className="sr-only">
          در حال بارگذاری اطلاعات
        </p>
      ) : null}

      {!loading && error ? (
        <div className="p-4">
          <Alert
            tone="danger"
            title={error.title ?? 'دریافت اطلاعات ناموفق بود'}
            action={error.action}
          >
            {error.description}
          </Alert>
        </div>
      ) : null}

      {!loading && !error && rows.length === 0 ? (
        <div className="p-4">
          <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
        </div>
      ) : null}

      {footer ? <div>{footer}</div> : null}
    </div>
  );
}
