'use client';

import Link from 'next/link';

import { CatalogSizeManager } from '@/components/products/product-variant-manager';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { DataTableColumn } from '@/components/ui/data-table';
import { FilterBar, SearchField } from '@/components/ui/filter-bar';
import { MobileDataCard } from '@/components/ui/mobile-data-card';
import { Pagination } from '@/components/ui/pagination';
import { ResponsiveDataView } from '@/components/ui/responsive-data-view';
import { Select } from '@/components/ui/select';
import type { VariantManagementData } from '@/lib/catalog/catalog-data';
import {
  productSizeModeLabel,
  type AdminProduct,
  type CatalogFilters,
} from '@/lib/catalog/catalog-model';
import { formatAdminInteger, toPersianDigits } from '@/lib/presentation/formatters';

type Props = Readonly<{
  data: VariantManagementData;
  filters: CatalogFilters;
  canWrite: boolean;
}>;

function buildHref(filters: CatalogFilters, page: number): string {
  const query = new URLSearchParams();
  if (filters.q) query.set('q', filters.q);
  if (filters.status) query.set('status', filters.status);
  if (page > 1) query.set('page', String(page));
  if (filters.limit !== 20) query.set('limit', String(filters.limit));
  const suffix = query.toString();
  return suffix ? `/variants?${suffix}` : '/variants';
}

function activeVariantCount(product: AdminProduct): number {
  return product.variants.filter((variant) => variant.active).length;
}

function ProductIdentity({ product }: Readonly<{ product: AdminProduct }>) {
  return (
    <div className="min-w-0">
      <p className="truncate font-bold">{product.name}</p>
      <p className="mt-1 truncate text-xs text-[var(--admin-color-subtle)]" dir="ltr">
        {toPersianDigits(product.slug)}
      </p>
    </div>
  );
}

function VariantBadges({ product }: Readonly<{ product: AdminProduct }>) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {product.variants.slice(0, 4).map((variant) => (
        <Badge key={variant.id} tone={variant.active ? 'info' : 'neutral'}>
          {toPersianDigits(variant.sku)}
        </Badge>
      ))}
      {product.variants.length > 4 ? (
        <Badge tone="neutral">+{formatAdminInteger(product.variants.length - 4)}</Badge>
      ) : null}
    </div>
  );
}

export function VariantManagementView({ data, filters, canWrite }: Props) {
  const list = data.products.data;
  const products = list?.items ?? [];
  const totalPages = list ? Math.max(1, Math.ceil(list.total / list.limit)) : 1;
  const totalVariants = products.reduce((sum, product) => sum + product.variants.length, 0);
  const activeVariants = products.reduce((sum, product) => sum + activeVariantCount(product), 0);
  const activeFilters = [filters.q, filters.status].filter(Boolean).length;

  const columns: readonly DataTableColumn<AdminProduct>[] = [
    { id: 'product', header: 'محصول', cell: (product) => <ProductIdentity product={product} /> },
    {
      id: 'size-mode',
      header: 'نوع سایزبندی',
      cell: (product) => productSizeModeLabel(product.sizeMode),
      visibility: 'sm',
    },
    {
      id: 'variants',
      header: 'تنوع‌ها',
      cell: (product) => (
        <span>
          {formatAdminInteger(activeVariantCount(product))} فعال از{' '}
          {formatAdminInteger(product.variants.length)}
        </span>
      ),
      align: 'center',
    },
    {
      id: 'skus',
      header: 'SKUها',
      cell: (product) => <VariantBadges product={product} />,
      visibility: 'lg',
    },
    {
      id: 'actions',
      header: 'عملیات',
      align: 'end',
      cell: (product) =>
        canWrite ? (
          <ButtonLink href={`/variants/${product.id}`} size="sm">
            مدیریت تنوع‌ها
          </ButtonLink>
        ) : (
          <span className="text-xs text-[var(--admin-color-subtle)]">فقط مشاهده</span>
        ),
    },
  ];

  return (
    <main className="admin-container py-6 sm:py-8 lg:py-10">
      <header className="flex flex-col gap-4 border-b border-[var(--admin-color-border)] pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Badge tone="info">مدیریت کاتالوگ</Badge>
          <h1 className="mt-3 text-2xl font-black sm:text-3xl">تنوع و سایزبندی محصولات</h1>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--admin-color-muted)]">
            SKU، نام، سایز، وزن و وضعیت هر تنوع را برای هر محصول مدیریت کنید. موجودی و سفارش‌ها نیز
            بر اساس همین SKUها ثبت می‌شوند.
          </p>
        </div>
        {canWrite ? <ButtonLink href="/products/new">ساخت محصول جدید</ButtonLink> : null}
      </header>

      {data.products.failed || data.sizes.failed ? (
        <Alert tone="danger" title="بخشی از اطلاعات دریافت نشد" className="mt-5">
          اتصال API را بررسی و صفحه را دوباره بارگذاری کنید.
        </Alert>
      ) : null}

      <section
        aria-label="خلاصه تنوع‌های این صفحه"
        className="mt-5 grid grid-cols-2 gap-2 lg:grid-cols-4"
      >
        {[
          ['محصولات نتیجه', list?.total ?? 0, 'محصول'],
          ['تنوع‌های این صفحه', totalVariants, 'تنوع'],
          ['تنوع فعال', activeVariants, 'فعال'],
          ['سایزهای کاتالوگ', data.sizes.data?.length ?? 0, 'سایز'],
        ].map(([label, value, unit]) => (
          <Card key={String(label)} className="p-0">
            <div className="p-3 sm:p-4">
              <p className="text-xs text-[var(--admin-color-muted)]">{label}</p>
              <div className="mt-2 flex items-end justify-between gap-2">
                <strong className="text-xl font-black">{formatAdminInteger(Number(value))}</strong>
                <Badge tone="neutral">{unit}</Badge>
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
              <Link href="/variants" className="font-semibold text-[var(--admin-color-primary)]">
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
            placeholder="جستجو با نام محصول، اسلاگ یا SKU"
            aria-label="جستجوی تنوع محصول"
          />
          <Select
            name="status"
            defaultValue={filters.status || 'all'}
            aria-label="فیلتر وضعیت محصول"
            options={[
              { value: 'all', label: 'همه وضعیت‌ها' },
              { value: 'ACTIVE', label: 'منتشرشده' },
              { value: 'DRAFT', label: 'پیش‌نویس' },
              { value: 'ARCHIVED', label: 'آرشیوشده' },
            ]}
          />
        </FilterBar>
      </form>

      <div className="mt-4">
        <ResponsiveDataView
          caption="فهرست محصولات و تنوع‌ها"
          mobileLabel="محصولات و تنوع‌ها"
          columns={columns}
          rows={products}
          getRowKey={(product) => product.id}
          footer={
            list ? (
              <Pagination
                currentPage={list.page}
                totalPages={totalPages}
                totalItems={list.total}
                pageSize={list.limit}
                getPageHref={(page) => buildHref(filters, page)}
              />
            ) : undefined
          }
          emptyTitle="محصولی پیدا نشد"
          emptyDescription="فیلترها را تغییر دهید یا ابتدا یک محصول بسازید."
          error={data.products.failed ? { description: 'فهرست محصولات دریافت نشد.' } : undefined}
          renderMobileCard={(product) => (
            <MobileDataCard
              title={product.name}
              eyebrow={toPersianDigits(product.slug)}
              status={<Badge tone="neutral">{productSizeModeLabel(product.sizeMode)}</Badge>}
              items={[
                {
                  label: 'تنوع فعال',
                  value: `${formatAdminInteger(activeVariantCount(product))} از ${formatAdminInteger(product.variants.length)}`,
                },
                { label: 'SKUها', value: <VariantBadges product={product} /> },
              ]}
              detailsTitle={`تنوع‌های ${product.name}`}
              detailsDescription="خلاصه SKUهای ثبت‌شده برای این محصول"
              details={<VariantBadges product={product} />}
              detailsFooter={
                canWrite ? (
                  <ButtonLink href={`/variants/${product.id}`}>مدیریت تنوع‌ها</ButtonLink>
                ) : undefined
              }
            />
          )}
        />
      </div>

      <div className="mt-6">
        {data.sizes.data ? (
          <CatalogSizeManager sizes={data.sizes.data} canWrite={canWrite} />
        ) : null}
      </div>
    </main>
  );
}
