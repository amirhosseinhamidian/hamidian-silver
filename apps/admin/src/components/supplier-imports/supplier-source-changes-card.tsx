'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Pagination } from '@/components/ui/pagination';
import { Select } from '@/components/ui/select';
import {
  formatAdminDateTime,
  formatAdminInteger,
  formatAdminToman,
} from '@/lib/presentation/formatters';
import {
  buildSupplierImportsHref,
  type AdminSupplierImportFilters,
  type AdminSupplierImportPage,
  type AdminSupplierSourceChange,
} from '@/lib/supplier-imports/supplier-imports-model';

type Props = Readonly<{
  changes: AdminSupplierImportPage<AdminSupplierSourceChange>;
  filters: AdminSupplierImportFilters;
  canWrite: boolean;
}>;

function availability(value: string | null) {
  if (value === 'IN_STOCK') return 'موجود';
  if (value === 'OUT_OF_STOCK') return 'ناموجود';
  return 'نامشخص';
}

function changeValue(change: AdminSupplierSourceChange, value: string | null) {
  if (change.type === 'AVAILABILITY') return availability(value);
  const amount = value === null ? null : Number(value);
  return amount !== null && Number.isFinite(amount) ? formatAdminToman(amount) : 'ثبت نشده';
}

export function SupplierSourceChangesCard({ changes, filters, canWrite }: Props) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function acknowledge(changeId: string) {
    setPendingId(changeId);
    setMessage(null);
    try {
      const response = await fetch(`/api/supplier-imports/changes/${changeId}/acknowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (!response.ok) throw new Error('ثبت بررسی تغییر انجام نشد.');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'ثبت بررسی تغییر انجام نشد.');
    } finally {
      setPendingId(null);
    }
  }

  return (
    <Card
      title={`تغییرات منبع (${formatAdminInteger(changes.total)})`}
      description="تغییر قیمت تک‌فروشی یا موجودی تأمین‌کننده فقط گزارش می‌شود و قیمت فروش سایت را تغییر نمی‌دهد."
    >
      {message ? (
        <Alert tone="danger" className="mb-3">
          {message}
        </Alert>
      ) : null}
      <div className="mb-3 flex justify-end">
        <Select
          aria-label="تعداد تغییرات منبع در هر صفحه"
          value={String(changes.pageSize)}
          onValueChange={(value) =>
            router.push(
              buildSupplierImportsHref(filters, {
                tab: 'CHANGES',
                changePage: 1,
                changePageSize: Number(value),
              }),
            )
          }
          options={[10, 20, 50, 100].map((value) => ({
            value: String(value),
            label: `${formatAdminInteger(value)} مورد در صفحه`,
          }))}
          className="w-48"
        />
      </div>
      {changes.items.length ? (
        <div className="space-y-3">
          {changes.items.map((change) => (
            <section
              key={change.id}
              className="rounded-[var(--admin-radius-md)] border border-[var(--admin-color-border)] p-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold">{change.productName ?? change.draftTitle}</p>
                    <Badge tone={change.type === 'PRICE' ? 'warning' : 'info'}>
                      {change.type === 'PRICE' ? 'تغییر قیمت منبع' : 'تغییر موجودی منبع'}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-[var(--admin-color-muted)]">
                    {change.supplierName} · {formatAdminDateTime(change.createdAt)}
                  </p>
                  <p className="mt-2 text-sm">
                    از {changeValue(change, change.previousValue)} به{' '}
                    <strong>{changeValue(change, change.newValue)}</strong>
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={
                      change.productId
                        ? `/products/${change.productId}/edit`
                        : `/products/new?importDraftId=${change.draftId}`
                    }
                    className="inline-flex min-h-9 items-center rounded-[var(--admin-radius-md)] border border-[var(--admin-color-border)] px-3 text-xs font-bold"
                  >
                    بررسی محصول
                  </Link>
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={pendingId === change.id}
                    disabled={!canWrite}
                    onClick={() => void acknowledge(change.id)}
                  >
                    بررسی شد
                  </Button>
                </div>
              </div>
            </section>
          ))}
        </div>
      ) : (
        <p className="text-sm text-[var(--admin-color-muted)]">تغییر بررسی‌نشده‌ای وجود ندارد.</p>
      )}
      <Pagination
        currentPage={changes.page}
        totalPages={changes.totalPages}
        totalItems={changes.total}
        pageSize={changes.pageSize}
        getPageHref={(page) =>
          buildSupplierImportsHref(filters, { tab: 'CHANGES', changePage: page })
        }
        className="mt-3 px-0"
      />
    </Card>
  );
}
