'use client';

/* eslint-disable @next/next/no-img-element -- media host is runtime-configured on the API/VPS. */

import Link from 'next/link';

import { ProductStatusActions } from '@/components/products/product-status-actions';
import { Alert } from '@/components/ui/alert';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FilterBar, SearchField } from '@/components/ui/filter-bar';
import { MobileDataCard } from '@/components/ui/mobile-data-card';
import { Pagination } from '@/components/ui/pagination';
import { ResponsiveDataView } from '@/components/ui/responsive-data-view';
import { Select } from '@/components/ui/select';
import type { ProductManagementData } from '@/lib/catalog/catalog-data';
import {
  productSizeModeLabel,
  productStatusLabel,
  type AdminProduct,
  type CatalogFilters,
  type ProductStatus,
} from '@/lib/catalog/catalog-model';
import {
  formatAdminDateTime,
  formatAdminInteger,
  formatAdminToman,
  toPersianDigits,
} from '@/lib/presentation/formatters';

type AdminProductsViewProps = Readonly<{
  data: ProductManagementData;
  filters: CatalogFilters;
  canWrite: boolean;
}>;

const STATUS_TONES: Record<ProductStatus, BadgeTone> = {
  ACTIVE: 'success',
  DRAFT: 'warning',
  ARCHIVED: 'neutral',
};

function StatusBadge({ status }: Readonly<{ status: ProductStatus }>) {
  return (
    <Badge tone={STATUS_TONES[status]} dot>
      {productStatusLabel(status)}
    </Badge>
  );
}

function ProductIdentity({ product }: Readonly<{ product: AdminProduct }>) {
  const preview = product.media.find((item) => item.isPrimary) ?? product.media[0];
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-[var(--admin-radius-md)] bg-[var(--admin-color-primary-soft)] text-sm font-black text-[var(--admin-color-primary)]">
        {preview?.url ? (
          <img
            src={preview.url}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          product.name.slice(0, 1)
        )}
      </span>
      <div className="min-w-0">
        <p className="truncate font-bold">{product.name}</p>
        <p className="mt-0.5 truncate text-xs text-[var(--admin-color-subtle)]" dir="ltr">
          {toPersianDigits(product.slug)}
        </p>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: Readonly<{ label: string; value: React.ReactNode }>) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[var(--admin-color-border)] py-3 last:border-0">
      <dt className="text-xs text-[var(--admin-color-muted)]">{label}</dt>
      <dd className="max-w-[65%] text-left text-sm font-semibold">{value}</dd>
    </div>
  );
}

function ProductDetails({ product }: Readonly<{ product: AdminProduct }>) {
  const activeVariants = product.variants.filter((variant) => variant.active).length;
  return (
    <div className="space-y-4">
      <dl>
        <DetailRow label="نام محصول" value={product.name} />
        <DetailRow label="وضعیت" value={productStatusLabel(product.status)} />
        <DetailRow
          label="قیمت فروش"
          value={
            product.salePriceToman === null ? 'ثبت نشده' : formatAdminToman(product.salePriceToman)
          }
        />
        <DetailRow label="برند" value={product.brand?.name ?? 'بدون برند'} />
        <DetailRow
          label="دسته‌بندی"
          value={product.categories.map(({ name }) => name).join('، ') || 'ثبت نشده'}
        />
        <DetailRow label="حالت سایز" value={productSizeModeLabel(product.sizeMode)} />
        <DetailRow label="تنوع فعال" value={formatAdminInteger(activeVariants)} />
        <DetailRow label="تعداد تصویر" value={formatAdminInteger(product.mediaCount)} />
        <DetailRow label="آخرین ویرایش" value={formatAdminDateTime(product.updatedAt)} />
      </dl>
      {product.variants.length > 0 ? (
        <section>
          <h4 className="text-xs font-bold text-[var(--admin-color-muted)]">SKUهای محصول</h4>
          <div className="mt-2 flex flex-wrap gap-2">
            {product.variants.map((variant) => (
              <Badge key={variant.id} tone={variant.active ? 'info' : 'neutral'}>
                {toPersianDigits(variant.sku)}
              </Badge>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function buildProductsHref(filters: CatalogFilters, page: number): string {
  const query = new URLSearchParams();
  if (filters.q) query.set('q', filters.q);
  if (filters.status) query.set('status', filters.status);
  if (filters.brandId) query.set('brandId', filters.brandId);
  if (filters.categoryId) query.set('categoryId', filters.categoryId);
  if (page > 1) query.set('page', String(page));
  if (filters.limit !== 20) query.set('limit', String(filters.limit));
  const suffix = query.toString();
  return suffix ? `/products?${suffix}` : '/products';
}

export function AdminProductsView({ data, filters, canWrite }: AdminProductsViewProps) {
  const list = data.products.data;
  const products = list?.items ?? [];
  const totalPages = list ? Math.max(1, Math.ceil(list.total / list.limit)) : 1;
  const activeFilters = [filters.q, filters.status, filters.brandId, filters.categoryId].filter(
    Boolean,
  ).length;
  const statusCounts = products.reduce<Record<ProductStatus, number>>(
    (counts, product) => ({ ...counts, [product.status]: counts[product.status] + 1 }),
    { ACTIVE: 0, DRAFT: 0, ARCHIVED: 0 },
  );

  const footer = list ? (
    <Pagination
      currentPage={list.page}
      totalPages={totalPages}
      totalItems={list.total}
      pageSize={list.limit}
      getPageHref={(page) => buildProductsHref(filters, page)}
    />
  ) : undefined;

  const columns = [
    {
      id: 'product',
      header: 'محصول',
      cell: (product: AdminProduct) => <ProductIdentity product={product} />,
    },
    {
      id: 'status',
      header: 'وضعیت',
      cell: (product: AdminProduct) => <StatusBadge status={product.status} />,
    },
    {
      id: 'price',
      header: 'قیمت فروش',
      cell: (product: AdminProduct) =>
        product.salePriceToman === null ? 'ثبت نشده' : formatAdminToman(product.salePriceToman),
      visibility: 'sm' as const,
    },
    {
      id: 'inventory',
      header: 'تنوع فعال',
      cell: (product: AdminProduct) =>
        formatAdminInteger(product.variants.filter((variant) => variant.active).length),
      visibility: 'md' as const,
      align: 'center' as const,
    },
    {
      id: 'updated',
      header: 'آخرین ویرایش',
      cell: (product: AdminProduct) => formatAdminDateTime(product.updatedAt),
      visibility: 'lg' as const,
    },
    {
      id: 'actions',
      header: 'عملیات',
      align: 'end' as const,
      cell: (product: AdminProduct) => (
          <div className="flex items-center justify-end gap-2">
            {canWrite ? (
              <>
                <ButtonLink href={`/products/${product.id}/edit`} size="sm" variant="outline">
                  ویرایش
                </ButtonLink>
                <ProductStatusActions
                  productId={product.id}
                  productName={product.name}
                  status={product.status}
                />
              </>
            ) : (
              <span className="text-xs text-[var(--admin-color-subtle)]">فقط مشاهده</span>
            )}
        </div>
      ),
    },
  ];

  return (
    <main className="admin-container py-6 sm:py-8 lg:py-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Badge tone="info">مرحله {formatAdminInteger(5)}</Badge>
          <h1 className="mt-3 text-2xl font-black sm:text-3xl">مدیریت محصولات</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--admin-color-muted)]">
            جستجو، کنترل انتشار و دسترسی سریع به اطلاعات عملیاتی کاتالوگ
          </p>
        </div>
        {canWrite ? <ButtonLink href="/products/new">افزودن محصول</ButtonLink> : null}
      </header>

      {data.products.failed || data.brands.failed || data.categories.failed ? (
        <Alert tone="danger" title="بخشی از اطلاعات کاتالوگ دریافت نشد" className="mt-5">
          اتصال API را بررسی و صفحه را دوباره بارگذاری کنید.
        </Alert>
      ) : null}

      <section
        aria-label="خلاصه محصولات این صفحه"
        className="mt-5 grid grid-cols-2 gap-2 lg:grid-cols-4"
      >
        {[
          ['کل نتیجه', list?.total ?? 0, 'neutral'],
          ['منتشرشده در این صفحه', statusCounts.ACTIVE, 'success'],
          ['پیش‌نویس در این صفحه', statusCounts.DRAFT, 'warning'],
          ['آرشیوشده در این صفحه', statusCounts.ARCHIVED, 'neutral'],
        ].map(([label, value, tone]) => (
          <Card key={String(label)} className="p-0">
            <div className="p-3 sm:p-4">
              <p className="text-xs text-[var(--admin-color-muted)]">{label}</p>
              <div className="mt-2 flex items-end justify-between gap-2">
                <strong className="text-xl font-black">{formatAdminInteger(Number(value))}</strong>
                <Badge tone={tone as BadgeTone}>محصول</Badge>
              </div>
            </div>
          </Card>
        ))}
      </section>

      <form method="get" className="mt-4">
        <FilterBar
          activeCount={activeFilters}
          resetAction={
            activeFilters ? (
              <Link href="/products" className="font-semibold text-[var(--admin-color-primary)]">
                پاک‌کردن فیلترها
              </Link>
            ) : undefined
          }
          actions={
            <Button type="submit" variant="outline">
              اعمال فیلتر
            </Button>
          }
        >
          <SearchField
            name="q"
            defaultValue={filters.q}
            placeholder="جستجو با نام، اسلاگ یا SKU"
            aria-label="جستجوی محصول"
          />
          <Select
            name="status"
            defaultValue={filters.status || 'all'}
            aria-label="فیلتر وضعیت"
            options={[
              { value: 'all', label: 'همه وضعیت‌ها' },
              { value: 'ACTIVE', label: 'منتشرشده' },
              { value: 'DRAFT', label: 'پیش‌نویس' },
              { value: 'ARCHIVED', label: 'آرشیوشده' },
            ]}
          />
          <Select
            name="brandId"
            defaultValue={filters.brandId || 'all'}
            aria-label="فیلتر برند"
            options={[
              { value: 'all', label: 'همه برندها' },
              ...(data.brands.data ?? []).map((brand) => ({ value: brand.id, label: brand.name })),
            ]}
          />
          <Select
            name="categoryId"
            defaultValue={filters.categoryId || 'all'}
            aria-label="فیلتر دسته‌بندی"
            options={[
              { value: 'all', label: 'همه دسته‌بندی‌ها' },
              ...(data.categories.data ?? []).map((category) => ({
                value: category.id,
                label: category.name,
              })),
            ]}
          />
        </FilterBar>
      </form>

      <div className="mt-4">
        <ResponsiveDataView
          caption="فهرست محصولات"
          mobileLabel="محصولات"
          columns={columns}
          rows={products}
          getRowKey={(product) => product.id}
          footer={footer}
          emptyTitle="محصولی پیدا نشد"
          emptyDescription="فیلترها را تغییر دهید یا یک محصول جدید بسازید."
          emptyAction={
            canWrite ? <ButtonLink href="/products/new">افزودن محصول</ButtonLink> : undefined
          }
          error={
            data.products.failed ? { description: 'فهرست محصولات از API دریافت نشد.' } : undefined
          }
          renderMobileCard={(product) => (
            <MobileDataCard
              title={product.name}
              eyebrow={toPersianDigits(product.slug)}
              status={<StatusBadge status={product.status} />}
              items={[
                {
                  label: 'قیمت',
                  value:
                    product.salePriceToman === null
                      ? 'ثبت نشده'
                      : formatAdminToman(product.salePriceToman),
                },
                {
                  label: 'تنوع فعال',
                  value: formatAdminInteger(
                    product.variants.filter((variant) => variant.active).length,
                  ),
                },
                { label: 'برند', value: product.brand?.name ?? 'بدون برند' },
                { label: 'آخرین ویرایش', value: formatAdminDateTime(product.updatedAt) },
              ]}
              detailsTitle={product.name}
              detailsDescription={`شناسه محصول: ${toPersianDigits(product.slug)}`}
              details={<ProductDetails product={product} />}
              detailsFooter={canWrite ? (
                <div className="grid w-full gap-2">
                  <ButtonLink href={`/products/${product.id}/edit`} variant="outline">
                    ویرایش محصول
                  </ButtonLink>
                  {canWrite ? (
                    <ProductStatusActions
                      productId={product.id}
                      productName={product.name}
                      status={product.status}
                      stacked
                    />
                  ) : null}
                </div>
              ) : undefined}
            />
          )}
        />
      </div>
    </main>
  );
}
