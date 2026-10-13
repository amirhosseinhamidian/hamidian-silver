'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import type {
  AdminSupplierCatalogCategory,
  AdminSupplierImportSource,
  AdminSupplierSourceCategory,
} from '@/lib/supplier-imports/supplier-imports-model';

type Props = Readonly<{
  sources: readonly AdminSupplierImportSource[];
  categories: readonly AdminSupplierSourceCategory[];
  catalogCategories: readonly AdminSupplierCatalogCategory[];
  canWrite: boolean;
}>;

export function SupplierCategoryMappingCard({
  sources,
  categories,
  catalogCategories,
  canWrite,
}: Props) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function update(categoryId: string, catalogCategoryId: string) {
    setPendingId(categoryId);
    setMessage(null);
    try {
      const response = await fetch(`/api/supplier-imports/categories/${categoryId}/mapping`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          catalogCategoryId: catalogCategoryId === 'none' ? null : catalogCategoryId,
        }),
      });
      if (!response.ok) throw new Error('ذخیره نگاشت دسته‌بندی انجام نشد.');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'ذخیره نگاشت انجام نشد.');
    } finally {
      setPendingId(null);
    }
  }

  return (
    <Card
      title="نگاشت دسته‌بندی‌ها"
      description="دسته تأمین‌کننده را به دسته داخلی سایت وصل کنید تا هنگام ساخت محصول به‌صورت پیش‌فرض انتخاب شود."
    >
      {message ? (
        <Alert tone="danger" className="mb-3">
          {message}
        </Alert>
      ) : null}
      {categories.length ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {categories.map((category) => {
            const source = sources.find((item) => item.id === category.supplierSourceId);
            return (
              <div
                key={category.id}
                className="grid gap-2 rounded-[var(--admin-radius-md)] border border-[var(--admin-color-border)] p-3 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,1fr)] sm:items-center"
              >
                <div>
                  <p className="text-sm font-bold">{category.name}</p>
                  <p className="mt-1 text-xs text-[var(--admin-color-muted)]">
                    {source?.supplierName ?? 'تأمین‌کننده'} · {source?.name ?? 'منبع'}
                  </p>
                </div>
                <Select
                  aria-label={`دسته داخلی برای ${category.name}`}
                  value={category.catalogCategoryId ?? 'none'}
                  onValueChange={(value) => void update(category.id, value)}
                  options={[
                    { value: 'none', label: 'بدون نگاشت' },
                    ...catalogCategories.map((item) => ({ value: item.id, label: item.name })),
                  ]}
                  disabled={!canWrite || pendingId === category.id}
                />
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-[var(--admin-color-muted)]">
          ابتدا دسته‌بندی‌های تأمین‌کننده را به‌روزرسانی کنید.
        </p>
      )}
    </Card>
  );
}
