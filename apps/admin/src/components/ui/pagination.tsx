import Link from 'next/link';

import { formatAdminInteger } from '@/lib/presentation/formatters';
import { cn } from '@/lib/ui/cn';

export type PaginationItem = number | 'ellipsis';

export function getPaginationItems(currentPage: number, totalPages: number): PaginationItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: Math.max(0, totalPages) }, (_, index) => index + 1);
  }

  if (currentPage <= 4) return [1, 2, 3, 4, 5, 'ellipsis', totalPages];
  if (currentPage >= totalPages - 3) {
    return [
      1,
      'ellipsis',
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages,
    ];
  }

  return [1, 'ellipsis', currentPage - 1, currentPage, currentPage + 1, 'ellipsis', totalPages];
}

type PaginationProps = Readonly<{
  currentPage: number;
  totalPages: number;
  getPageHref: (page: number) => string;
  totalItems?: number;
  pageSize?: number;
  className?: string;
}>;

const pageClassName =
  'grid size-9 place-items-center rounded-[var(--admin-radius-md)] border text-xs font-bold outline-none transition-colors focus-visible:shadow-[var(--admin-focus-ring)]';

export function Pagination({
  currentPage,
  totalPages,
  getPageHref,
  totalItems,
  pageSize,
  className,
}: PaginationProps) {
  if (totalPages < 1 || (totalPages === 1 && totalItems === undefined)) return null;

  const safeCurrentPage = Math.min(Math.max(currentPage, 1), Math.max(totalPages, 1));
  const items = getPaginationItems(safeCurrentPage, totalPages);
  const rangeStart = pageSize && totalItems ? (safeCurrentPage - 1) * pageSize + 1 : undefined;
  const rangeEnd =
    pageSize && totalItems ? Math.min(safeCurrentPage * pageSize, totalItems) : undefined;

  return (
    <nav
      aria-label="صفحه‌بندی"
      className={cn(
        'flex flex-col gap-3 border-t border-[var(--admin-color-border)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <p className="text-xs text-[var(--admin-color-muted)]">
        {rangeStart !== undefined && rangeEnd !== undefined && totalItems !== undefined
          ? `نمایش ${formatAdminInteger(rangeStart)} تا ${formatAdminInteger(rangeEnd)} از ${formatAdminInteger(totalItems)}`
          : `صفحه ${formatAdminInteger(safeCurrentPage)} از ${formatAdminInteger(totalPages)}`}
      </p>

      <div className="flex items-center gap-1" dir="rtl">
        <PaginationDirectionLink
          label="صفحه قبل"
          disabled={safeCurrentPage <= 1}
          href={getPageHref(Math.max(1, safeCurrentPage - 1))}
        >
          قبلی
        </PaginationDirectionLink>
        {items.map((item, index) =>
          item === 'ellipsis' ? (
            <span
              key={`ellipsis-${index}`}
              aria-hidden="true"
              className="grid size-9 place-items-center text-[var(--admin-color-subtle)]"
            >
              …
            </span>
          ) : (
            <Link
              key={item}
              href={getPageHref(item)}
              aria-label={`صفحه ${formatAdminInteger(item)}`}
              aria-current={item === safeCurrentPage ? 'page' : undefined}
              className={cn(
                pageClassName,
                item === safeCurrentPage
                  ? 'border-[var(--admin-color-primary)] bg-[var(--admin-color-primary)] text-white'
                  : 'border-transparent text-[var(--admin-color-muted)] hover:border-[var(--admin-color-border)] hover:bg-[var(--admin-color-surface-hover)] hover:text-[var(--admin-color-ink)]',
              )}
            >
              {formatAdminInteger(item)}
            </Link>
          ),
        )}
        <PaginationDirectionLink
          label="صفحه بعد"
          disabled={safeCurrentPage >= totalPages}
          href={getPageHref(Math.min(totalPages, safeCurrentPage + 1))}
        >
          بعدی
        </PaginationDirectionLink>
      </div>
    </nav>
  );
}

function PaginationDirectionLink({
  label,
  href,
  disabled,
  children,
}: Readonly<{
  label: string;
  href: string;
  disabled: boolean;
  children: string;
}>) {
  const className =
    'inline-flex min-h-9 items-center rounded-[var(--admin-radius-md)] px-2.5 text-xs font-semibold outline-none focus-visible:shadow-[var(--admin-focus-ring)]';

  return disabled ? (
    <span
      aria-disabled="true"
      className={cn(className, 'cursor-default text-[var(--admin-color-subtle)]')}
    >
      {children}
    </span>
  ) : (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        className,
        'text-[var(--admin-color-muted)] hover:bg-[var(--admin-color-surface-hover)] hover:text-[var(--admin-color-ink)]',
      )}
    >
      {children}
    </Link>
  );
}
