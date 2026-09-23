'use client';

import Image from 'next/image';
import { useId, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-control';
import type { ProductRelationCandidate } from '@/lib/catalog/catalog-data';

function normalizeSearch(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase('fa-IR')
    .replaceAll('ي', 'ی')
    .replaceAll('ك', 'ک')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/\s+/g, ' ');
}

function ProductThumbnail({ product }: Readonly<{ product: ProductRelationCandidate }>) {
  return (
    <span className="relative grid size-14 shrink-0 place-items-center overflow-hidden rounded-[var(--admin-radius-md)] border border-[var(--admin-color-border)] bg-[var(--admin-color-surface-subtle)] text-[0.65rem] text-[var(--admin-color-muted)]">
      {product.thumbnailUrl ? (
        <Image
          src={product.thumbnailUrl}
          alt={product.thumbnailAlt ?? product.name}
          fill
          unoptimized
          sizes="56px"
          className="object-cover"
        />
      ) : (
        <span aria-hidden="true">بدون تصویر</span>
      )}
    </span>
  );
}

export function RelatedProductPicker({
  products,
  initialSelectedIds,
  disabled = false,
}: Readonly<{
  products: readonly ProductRelationCandidate[];
  initialSelectedIds: readonly string[];
  disabled?: boolean;
}>) {
  const searchId = useId();
  const searchHintId = `${searchId}-hint`;
  const [query, setQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<readonly string[]>(initialSelectedIds);
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedProducts = useMemo(
    () => products.filter(({ id }) => selectedIdSet.has(id)),
    [products, selectedIdSet],
  );
  const normalizedQuery = normalizeSearch(query);
  const results = useMemo(() => {
    if (normalizedQuery.length < 2) return [];

    return products
      .filter((product) =>
        normalizeSearch(`${product.name} ${product.slug} ${product.skus.join(' ')}`).includes(
          normalizedQuery,
        ),
      )
      .slice(0, 12);
  }, [normalizedQuery, products]);

  function toggle(productId: string) {
    setSelectedIds((current) =>
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId],
    );
  }

  return (
    <div className="space-y-5">
      {selectedIds.map((productId) => (
        <input key={productId} type="hidden" name="relatedProductIds" value={productId} />
      ))}

      <div>
        <label htmlFor={searchId} className="mb-2 block text-sm font-semibold">
          جست‌وجوی محصولات
        </label>
        <Input
          id={searchId}
          type="search"
          value={query}
          disabled={disabled}
          aria-describedby={searchHintId}
          placeholder="نام، اسلاگ یا SKU محصول را بنویسید"
          autoComplete="off"
          onChange={(event) => setQuery(event.target.value)}
        />
        <p id={searchHintId} className="mt-2 text-xs text-[var(--admin-color-muted)]">
          برای نمایش نتایج حداقل دو نویسه وارد کنید؛ حداکثر ۱۲ نتیجه نمایش داده می‌شود.
        </p>
      </div>

      {selectedProducts.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-semibold text-[var(--admin-color-muted)]">
            محصولات مرتبط انتخاب‌شده
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {selectedProducts.map((product) => (
              <div
                key={product.id}
                className="flex items-center gap-3 rounded-[var(--admin-radius-md)] border border-[var(--admin-color-border)] p-2"
              >
                <ProductThumbnail product={product} />
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-sm">{product.name}</strong>
                  <span
                    dir="ltr"
                    className="mt-1 block truncate text-left text-xs text-[var(--admin-color-muted)]"
                  >
                    {product.slug}
                  </span>
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={disabled}
                  aria-label={`حذف ${product.name} از محصولات مرتبط`}
                  onClick={() => toggle(product.id)}
                >
                  حذف
                </Button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-[var(--admin-color-muted)]">
          هنوز محصول مرتبطی انتخاب نشده است.
        </p>
      )}

      {normalizedQuery.length >= 2 ? (
        results.length > 0 ? (
          <div>
            <p className="mb-2 text-xs font-semibold text-[var(--admin-color-muted)]">
              نتایج جست‌وجو
            </p>
            <div className="grid max-h-80 gap-2 overflow-y-auto pe-1 sm:grid-cols-2">
              {results.map((product) => {
                const selected = selectedIdSet.has(product.id);

                return (
                  <button
                    key={product.id}
                    type="button"
                    disabled={disabled}
                    aria-pressed={selected}
                    aria-label={`${selected ? 'حذف' : 'افزودن'} ${product.name} ${
                      selected ? 'از' : 'به'
                    } محصولات مرتبط`}
                    onClick={() => toggle(product.id)}
                    className={`flex items-center gap-3 rounded-[var(--admin-radius-md)] border p-2 text-right transition-colors disabled:opacity-50 ${
                      selected
                        ? 'border-[var(--admin-color-primary)] bg-[var(--admin-color-primary-soft)]'
                        : 'border-[var(--admin-color-border)] hover:border-[var(--admin-color-border-strong)] hover:bg-[var(--admin-color-surface-subtle)]'
                    }`}
                  >
                    <ProductThumbnail product={product} />
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate text-sm">{product.name}</strong>
                      <span
                        dir="ltr"
                        className="mt-1 block truncate text-left text-xs text-[var(--admin-color-muted)]"
                      >
                        {product.slug}
                      </span>
                      {product.skus[0] ? (
                        <span
                          dir="ltr"
                          className="mt-1 block truncate text-left text-[0.65rem] text-[var(--admin-color-subtle)]"
                        >
                          SKU: {product.skus.slice(0, 2).join('، ')}
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 text-xs font-semibold text-[var(--admin-color-primary)]">
                      {selected ? 'انتخاب شده' : 'افزودن'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="text-sm text-[var(--admin-color-muted)]">
            محصولی مطابق این عبارت پیدا نشد.
          </p>
        )
      ) : null}
    </div>
  );
}
