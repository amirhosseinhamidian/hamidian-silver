'use client';

import Image from 'next/image';
import { useId, useState, type ReactNode } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-control';
import { FormField } from '@/components/ui/form-field';
import {
  useCampaignSelection,
  type CampaignProductOption,
  type CampaignProductOptions,
  type CampaignTaxonomy,
} from '@/lib/campaigns/campaign-selection';
import { formatAdminInteger, formatAdminToman } from '@/lib/presentation/formatters';

const endpoint = '/api/campaigns/product-options';
const selectClass =
  'min-h-10 w-full min-w-0 rounded-md border border-[var(--admin-color-border)] bg-[var(--admin-color-surface)] px-2 text-sm';

function ProductOption({
  product,
  children,
}: {
  product: CampaignProductOption;
  children?: ReactNode;
}) {
  return (
    <li className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--admin-color-border)] p-2">
      <span className="relative grid size-12 shrink-0 place-items-center overflow-hidden rounded bg-[var(--admin-color-surface-subtle)] text-[0.6rem]">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.imageAlt ?? ''}
            fill
            unoptimized
            sizes="48px"
            className="object-cover"
          />
        ) : (
          <span aria-hidden="true">بدون تصویر</span>
        )}
      </span>
      <div className="min-w-0 flex-1 space-y-1 text-xs [overflow-wrap:anywhere]">
        <strong className="text-sm">{product.name}</strong>
        <p>
          {product.defaultPriceToman == null
            ? 'قیمت پیش‌فرض ثبت نشده'
            : formatAdminToman(product.defaultPriceToman)}
        </p>
        {product.festivalPriceToman != null && (
          <p>پیش‌نمایش قیمت جشنواره {formatAdminToman(product.festivalPriceToman)}</p>
        )}
        <p className="text-[var(--admin-color-muted)]">
          {product.availableQuantity > 0
            ? `موجودی ${formatAdminInteger(product.availableQuantity)}`
            : 'ناموجود'}
          {product.quotaRemaining != null
            ? ` · ماندهٔ سهمیه ${formatAdminInteger(product.quotaRemaining)}`
            : ''}
          {product.categories.length ? ` · ${product.categories.join('، ')}` : ''}
        </p>
      </div>
      {children}
    </li>
  );
}

type Props = Readonly<{
  selected?: readonly string[];
  onSelect?: (slug: string) => void;
  onRemove?: (slug: string) => void;
  disabled?: boolean;
  max?: number;
  taxonomy?: CampaignTaxonomy;
  campaignId?: string;
  withinCampaign?: boolean;
  fixedCategory?: string;
  fixedBrand?: string;
  categoryMode?: 'direct' | 'tree';
}>;

export function CampaignProductSearch({
  selected = [],
  onSelect,
  onRemove,
  disabled = false,
  max = 50,
  taxonomy,
  campaignId,
  withinCampaign,
  fixedCategory,
  fixedBrand,
  categoryMode = 'tree',
}: Props) {
  const id = useId();
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [searchOpen, setSearchOpen] = useState(Boolean(fixedCategory || fixedBrand));
  const [category, setCategory] = useState('');
  const [brand, setBrand] = useState('');
  const [stock, setStock] = useState('');
  const [pickedIds, setPickedIds] = useState<Readonly<Record<string, string>>>({});
  const term = query.trim();
  const parameters = new URLSearchParams({ page: String(page), categoryMode });
  for (const [key, value] of Object.entries({
    q: term,
    category: fixedCategory ?? category,
    brand: fixedBrand ?? brand,
    stock,
    campaignId,
    scope: withinCampaign ? 'campaign' : '',
  })) {
    if (value) parameters.set(key, value);
  }
  const results = useCampaignSelection<CampaignProductOptions>(
    searchOpen && term.length !== 1 ? `${endpoint}?${parameters}` : null,
    250,
  );
  const details = useCampaignSelection<CampaignProductOptions>(
    onRemove && selected.length ? endpoint : null,
    0,
    JSON.stringify({ selected, campaignId }),
  );
  const selectedProducts = new Map(details.data?.items.map((product) => [product.slug, product]));
  const selectedIds = new Set(
    selected.map((slug) => selectedProducts.get(slug)?.id ?? pickedIds[slug]),
  );
  const isPicked = (product: CampaignProductOption) =>
    selectedIds.has(product.id) || selected.includes(product.slug);

  return (
    <div className="min-w-0 space-y-3">
      {onRemove && (
        <div className="space-y-2">
          <p className="text-xs font-semibold">
            محصولات انتخاب‌شده ({formatAdminInteger(selected.length)} از {formatAdminInteger(max)})
          </p>
          {details.failed && (
            <Alert tone="danger">
              دریافت جزئیات انتخاب‌ها ممکن نشد.{' '}
              <Button onClick={details.retry} size="sm" variant="outline">
                تلاش دوباره
              </Button>
            </Alert>
          )}
          {selected.length > 0 && (
            <ul aria-label="محصولات انتخاب‌شده" className="grid gap-2 sm:grid-cols-2">
              {selected.map((slug) => {
                const product = selectedProducts.get(slug);
                const remove = (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={disabled}
                    aria-label={`حذف ${product?.name ?? slug}`}
                    onClick={() => onRemove(slug)}
                  >
                    حذف
                  </Button>
                );
                return product ? (
                  <ProductOption key={slug} product={product}>
                    {remove}
                  </ProductOption>
                ) : (
                  <li
                    key={slug}
                    className="flex items-center justify-between gap-2 rounded-lg border p-2 text-xs"
                  >
                    <bdi className="[overflow-wrap:anywhere]">{slug}</bdi>
                    {remove}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
      {!searchOpen ? (
        <Button variant="outline" disabled={disabled} onClick={() => setSearchOpen(true)}>
          جست‌وجوی محصولات
        </Button>
      ) : (
        <>
          <FormField id={id} label="جست‌وجوی محصول" hint="نام، شناسه، SKU یا اسلاگ را وارد کنید.">
            {(control) => (
              <Input
                {...control}
                type="search"
                value={query}
                maxLength={96}
                disabled={disabled}
                onChange={(event) => {
                  setQuery(event.currentTarget.value);
                  setPage(1);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.nativeEvent.isComposing)
                    event.preventDefault();
                }}
              />
            )}
          </FormField>
          <div className="grid gap-2 sm:grid-cols-3">
            {!fixedCategory && taxonomy && (
              <label className="grid gap-1 text-xs">
                دسته
                <select
                  className={selectClass}
                  value={category}
                  disabled={disabled}
                  onChange={(event) => {
                    setCategory(event.currentTarget.value);
                    setPage(1);
                  }}
                >
                  <option value="">همهٔ دسته‌ها</option>
                  {taxonomy.categories.map((item) => (
                    <option key={item.id} value={item.slug}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {!fixedBrand && taxonomy && (
              <label className="grid gap-1 text-xs">
                برند
                <select
                  className={selectClass}
                  value={brand}
                  disabled={disabled}
                  onChange={(event) => {
                    setBrand(event.currentTarget.value);
                    setPage(1);
                  }}
                >
                  <option value="">همهٔ برندها</option>
                  {taxonomy.brands.map((item) => (
                    <option key={item.id} value={item.slug}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="grid gap-1 text-xs">
              موجودی
              <select
                className={selectClass}
                value={stock}
                disabled={disabled}
                onChange={(event) => {
                  setStock(event.currentTarget.value);
                  setPage(1);
                }}
              >
                <option value="">همهٔ وضعیت‌ها</option>
                <option value="in-stock">موجود</option>
                <option value="out-of-stock">ناموجود</option>
              </select>
            </label>
          </div>
          {term.length === 1 && (
            <p className="text-sm" role="status">
              برای جست‌وجو دست‌کم دو نویسه وارد کنید.
            </p>
          )}
          {results.loading && (
            <p className="text-sm" role="status">
              در حال دریافت محصولات…
            </p>
          )}
          {results.failed && (
            <Alert tone="danger">
              دریافت محصولات ممکن نشد.{' '}
              <Button variant="outline" size="sm" onClick={results.retry}>
                تلاش دوباره
              </Button>
            </Alert>
          )}
          {results.data && (
            <>
              {results.data.items.length === 0 ? (
                <p role="status" className="text-sm">
                  محصولی با این شرایط پیدا نشد.
                </p>
              ) : (
                <ul aria-label="نتایج جست‌وجوی محصول" className="grid gap-2 sm:grid-cols-2">
                  {results.data.items.map((product) => (
                    <ProductOption key={product.id} product={product}>
                      {onSelect && (
                        <Button
                          size="sm"
                          variant="outline"
                          aria-label={`انتخاب ${product.name}`}
                          disabled={disabled || isPicked(product) || selected.length >= max}
                          onClick={() => {
                            setPickedIds((current) => ({ ...current, [product.slug]: product.id }));
                            onSelect(product.slug);
                          }}
                        >
                          {isPicked(product) ? 'انتخاب‌شده' : 'انتخاب'}
                        </Button>
                      )}
                    </ProductOption>
                  ))}
                </ul>
              )}
              {(page > 1 || results.data.hasMore) && (
                <nav aria-label="صفحه‌بندی محصولات" className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={disabled || page === 1}
                    onClick={() => setPage(page - 1)}
                  >
                    صفحهٔ قبل
                  </Button>
                  <span className="text-xs">صفحهٔ {formatAdminInteger(page)}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={disabled || !results.data.hasMore || page >= 1000}
                    onClick={() => setPage(page + 1)}
                  >
                    صفحهٔ بعد
                  </Button>
                </nav>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
