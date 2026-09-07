'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useId, useMemo, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { BottomSheet, BottomSheetContent, BottomSheetTrigger } from '@/components/ui/bottom-sheet';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { DataTableColumn } from '@/components/ui/data-table';
import { DonutChart } from '@/components/ui/donut-chart';
import { FilterBar, SearchField } from '@/components/ui/filter-bar';
import { Input, Textarea } from '@/components/ui/form-control';
import { FormField } from '@/components/ui/form-field';
import { MobileDataCard } from '@/components/ui/mobile-data-card';
import { ResponsiveDataView } from '@/components/ui/responsive-data-view';
import { Select } from '@/components/ui/select';
import {
  formatAdminDateTime,
  formatAdminInteger,
  formatAdminToman,
  toAsciiDigits,
  toPersianDigits,
} from '@/lib/presentation/formatters';
import {
  productDiscountPercent,
  productGrossMargin,
  type AdminPricingCatalog,
  type AdminPricingHistory,
  type AdminPricingProduct,
  type AdminPricingRate,
} from '@/lib/pricing/pricing-model';

type PricingManagementViewProps = Readonly<{
  catalog: AdminPricingCatalog | null;
  failed: boolean;
  canWrite: boolean;
}>;

function normalizeMoneyInput(value: string): string {
  return toPersianDigits(toAsciiDigits(value).replace(/[^\d]/g, ''));
}

function parseMoney(value: string): number | null {
  const normalized = toAsciiDigits(value).replace(/[^\d]/g, '');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function apiError(payload: unknown): string {
  const translations: Record<string, string> = {
    'Product was not found.': 'محصول پیدا نشد یا دیگر در دسترس نیست.',
    'Compare-at price must be greater than sale price.':
      'قیمت قبل از تخفیف باید بیشتر از قیمت فروش باشد.',
  };
  if (typeof payload === 'object' && payload !== null) {
    const value = payload as Record<string, unknown>;
    if (typeof value.message === 'string') return translations[value.message] ?? value.message;
    if (Array.isArray(value.message)) return value.message.join('، ');
    const nested = value.error as Record<string, unknown> | undefined;
    if (typeof nested?.message === 'string') return translations[nested.message] ?? nested.message;
  }
  return 'تغییر قیمت انجام نشد. دوباره تلاش کنید.';
}

function productStatus(status: AdminPricingProduct['status']) {
  if (status === 'ACTIVE') return <Badge tone="success">منتشرشده</Badge>;
  if (status === 'DRAFT') return <Badge tone="warning">پیش‌نویس</Badge>;
  return <Badge tone="neutral">آرشیوشده</Badge>;
}

function pricingStatus(product: AdminPricingProduct) {
  const margin = productGrossMargin(product);
  if (product.salePriceToman === null)
    return (
      <Badge tone="danger" dot>
        بدون قیمت
      </Badge>
    );
  if (margin !== null && margin < 0)
    return (
      <Badge tone="danger" dot>
        زیان‌ده
      </Badge>
    );
  if (product.compareAtPriceToman !== null)
    return (
      <Badge tone="info" dot>
        دارای تخفیف
      </Badge>
    );
  return (
    <Badge tone="success" dot>
      قیمت‌گذاری‌شده
    </Badge>
  );
}

function ProductPriceForm({
  formId,
  product,
  onSaved,
  onPendingChange,
}: Readonly<{
  formId: string;
  product: AdminPricingProduct;
  onSaved: () => void;
  onPendingChange: (pending: boolean) => void;
}>) {
  const router = useRouter();
  const [salePrice, setSalePrice] = useState(
    product.salePriceToman === null ? '' : toPersianDigits(product.salePriceToman),
  );
  const [compareAtPrice, setCompareAtPrice] = useState(
    product.compareAtPriceToman === null ? '' : toPersianDigits(product.compareAtPriceToman),
  );
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const sale = parseMoney(salePrice);
    const compareAt = parseMoney(compareAtPrice);
    if (sale === null || sale < 0) return setError('قیمت فروش معتبر و الزامی است.');
    if (compareAtPrice && (compareAt === null || compareAt <= sale))
      return setError('قیمت قبل از تخفیف باید بیشتر از قیمت فروش باشد.');
    if (!reason.trim()) return setError('دلیل تغییر قیمت را ثبت کنید.');
    setError(null);
    onPendingChange(true);
    try {
      const response = await fetch(`/api/pricing/products/${product.id}/sale-price`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salePriceToman: sale,
          compareAtPriceToman: compareAtPrice ? compareAt : null,
          reason: reason.trim(),
        }),
      });
      const payload = (await response.json().catch(() => null)) as unknown;
      if (!response.ok) throw new Error(apiError(payload));
      onSaved();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : apiError(null));
    } finally {
      onPendingChange(false);
    }
  }

  return (
    <form id={formId} onSubmit={(event) => void submit(event)} className="space-y-4">
      {error ? (
        <Alert tone="danger" title="ذخیره قیمت ناموفق بود">
          {error}
        </Alert>
      ) : null}
      <div className="rounded-[var(--admin-radius-md)] bg-[var(--admin-color-surface-subtle)] p-3 text-xs leading-6 text-[var(--admin-color-muted)]">
        {product.supplierCostToman === null ? (
          'برای این محصول قیمت خرید منتخب ثبت نشده است.'
        ) : (
          <>
            قیمت خرید منتخب از {product.supplierName}:‌{' '}
            <strong className="text-[var(--admin-color-ink)]">
              {formatAdminToman(product.supplierCostToman)}
            </strong>
          </>
        )}
      </div>
      <FormField id={`${formId}-sale`} label="قیمت فروش" hint="مبلغ نهایی به تومان" required>
        {(props) => (
          <Input
            {...props}
            value={salePrice}
            onChange={(event) => setSalePrice(normalizeMoneyInput(event.target.value))}
            placeholder="مثلاً ۱٬۳۵۰٬۰۰۰"
            inputMode="numeric"
            required
          />
        )}
      </FormField>
      <FormField
        id={`${formId}-compare`}
        label="قیمت قبل از تخفیف"
        hint="اختیاری؛ باید از قیمت فروش بیشتر باشد"
      >
        {(props) => (
          <Input
            {...props}
            value={compareAtPrice}
            onChange={(event) => setCompareAtPrice(normalizeMoneyInput(event.target.value))}
            placeholder="مثلاً ۱٬۵۰۰٬۰۰۰"
            inputMode="numeric"
          />
        )}
      </FormField>
      <FormField id={`${formId}-reason`} label="دلیل تغییر" required>
        {(props) => (
          <Textarea
            {...props}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="مثلاً به‌روزرسانی قیمت طبق لیست جدید تأمین‌کننده"
            maxLength={500}
            required
          />
        )}
      </FormField>
    </form>
  );
}

function ProductReadonlyDetails({ product }: Readonly<{ product: AdminPricingProduct }>) {
  const margin = productGrossMargin(product);
  const discount = productDiscountPercent(product);
  return (
    <dl className="divide-y divide-[var(--admin-color-border)]">
      {[
        ['محصول', product.name],
        [
          'وضعیت کاتالوگ',
          product.status === 'ACTIVE'
            ? 'منتشرشده'
            : product.status === 'DRAFT'
              ? 'پیش‌نویس'
              : 'آرشیوشده',
        ],
        [
          'قیمت فروش',
          product.salePriceToman === null ? 'ثبت نشده' : formatAdminToman(product.salePriceToman),
        ],
        [
          'قیمت قبل از تخفیف',
          product.compareAtPriceToman === null
            ? 'ثبت نشده'
            : formatAdminToman(product.compareAtPriceToman),
        ],
        ['تخفیف', discount === null ? 'بدون تخفیف' : `${formatAdminInteger(discount)}٪`],
        [
          'قیمت خرید منتخب',
          product.supplierCostToman === null
            ? 'ثبت نشده'
            : formatAdminToman(product.supplierCostToman),
        ],
        ['حاشیه ناخالص', margin === null ? 'قابل محاسبه نیست' : formatAdminToman(margin)],
      ].map(([label, value]) => (
        <div key={label} className="flex justify-between gap-4 py-3 text-sm">
          <dt className="text-[var(--admin-color-muted)]">{label}</dt>
          <dd className="max-w-[65%] text-left font-semibold">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ProductPriceSheet({
  product,
  canWrite,
  triggerLabel = 'مدیریت قیمت',
}: Readonly<{ product: AdminPricingProduct; canWrite: boolean; triggerLabel?: string }>) {
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  return (
    <BottomSheet open={open} onOpenChange={setOpen}>
      <BottomSheetTrigger asChild>
        <Button variant="outline" size="sm">
          {triggerLabel}
        </Button>
      </BottomSheetTrigger>
      <BottomSheetContent
        title={product.name}
        description={
          canWrite ? 'قیمت فروش و وضعیت تخفیف را به‌روزرسانی کنید.' : 'جزئیات قیمت محصول'
        }
        height="large"
        footer={
          canWrite ? (
            <>
              <Button variant="outline" disabled={pending} onClick={() => setOpen(false)}>
                انصراف
              </Button>
              <Button type="submit" form={formId} loading={pending}>
                ذخیره قیمت
              </Button>
            </>
          ) : undefined
        }
      >
        {canWrite ? (
          <ProductPriceForm
            formId={formId}
            product={product}
            onSaved={() => setOpen(false)}
            onPendingChange={setPending}
          />
        ) : (
          <ProductReadonlyDetails product={product} />
        )}
      </BottomSheetContent>
    </BottomSheet>
  );
}

function ProductMobileCard({
  product,
  canWrite,
}: Readonly<{ product: AdminPricingProduct; canWrite: boolean }>) {
  const margin = productGrossMargin(product);
  const discount = productDiscountPercent(product);
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  return (
    <MobileDataCard
      eyebrow={productStatus(product.status)}
      title={product.name}
      status={pricingStatus(product)}
      items={[
        {
          label: 'قیمت فروش',
          value:
            product.salePriceToman === null ? 'ثبت نشده' : formatAdminToman(product.salePriceToman),
        },
        { label: 'تخفیف', value: discount === null ? '—' : `${formatAdminInteger(discount)}٪` },
        {
          label: 'قیمت خرید',
          value:
            product.supplierCostToman === null
              ? 'ثبت نشده'
              : formatAdminToman(product.supplierCostToman),
        },
        { label: 'حاشیه ناخالص', value: margin === null ? '—' : formatAdminToman(margin) },
      ]}
      detailsTitle={product.name}
      detailsDescription={canWrite ? 'ویرایش قیمت و جزئیات مالی محصول' : 'جزئیات مالی محصول'}
      detailsOpen={open}
      onDetailsOpenChange={setOpen}
      details={
        canWrite ? (
          <ProductPriceForm
            formId={formId}
            product={product}
            onSaved={() => setOpen(false)}
            onPendingChange={setPending}
          />
        ) : (
          <ProductReadonlyDetails product={product} />
        )
      }
      detailsFooter={
        canWrite ? (
          <Button type="submit" form={formId} loading={pending}>
            ذخیره قیمت
          </Button>
        ) : undefined
      }
    />
  );
}

function RateCard({ rate }: Readonly<{ rate: AdminPricingRate }>) {
  const label = rate.type === 'GOLD' ? 'آبکاری طلا' : 'آبکاری رودیوم';
  return (
    <Card
      title={label}
      description={`آخرین تغییر: ${formatAdminDateTime(rate.updatedAt)}`}
      action={
        <Badge tone={rate.active ? 'success' : 'neutral'} dot>
          {rate.active ? 'فعال' : 'غیرفعال'}
        </Badge>
      }
    >
      <p className="text-xl font-black">{formatAdminToman(rate.pricePerGramToman)}</p>
      <p className="mt-1 text-xs text-[var(--admin-color-muted)]">
        برای هر گرم · زمان انجام {formatAdminInteger(rate.leadTimeDays)} روز
      </p>
    </Card>
  );
}

function HistoryDetails({ item }: Readonly<{ item: AdminPricingHistory }>) {
  return (
    <dl className="divide-y divide-[var(--admin-color-border)]">
      {[
        ['نوع تغییر', item.kind === 'PRODUCT' ? 'قیمت محصول' : 'نرخ آبکاری'],
        ['عنوان', item.title],
        [
          'مقدار قبلی',
          item.previousPriceToman === null ? 'ثبت نشده' : formatAdminToman(item.previousPriceToman),
        ],
        ['مقدار جدید', formatAdminToman(item.newPriceToman)],
        ...(item.kind === 'PRODUCT'
          ? ([
              [
                'قیمت قبل از تخفیف قبلی',
                item.previousCompareAtPriceToman === null
                  ? 'ثبت نشده'
                  : formatAdminToman(item.previousCompareAtPriceToman),
              ],
              [
                'قیمت قبل از تخفیف جدید',
                item.newCompareAtPriceToman === null
                  ? 'حذف شده'
                  : formatAdminToman(item.newCompareAtPriceToman),
              ],
            ] as const)
          : ([
              [
                'زمان قبلی',
                item.previousLeadTimeDays === null
                  ? 'ثبت نشده'
                  : `${formatAdminInteger(item.previousLeadTimeDays)} روز`,
              ],
              [
                'زمان جدید',
                item.newLeadTimeDays === null
                  ? 'ثبت نشده'
                  : `${formatAdminInteger(item.newLeadTimeDays)} روز`,
              ],
            ] as const)),
        ['ثبت‌کننده', toPersianDigits(item.actor)],
        ['زمان ثبت', formatAdminDateTime(item.createdAt)],
        ['دلیل', item.reason ? toPersianDigits(item.reason) : 'ثبت نشده'],
      ].map(([label, value]) => (
        <div key={label} className="flex justify-between gap-4 py-3 text-sm">
          <dt className="text-[var(--admin-color-muted)]">{label}</dt>
          <dd className="max-w-[65%] text-left font-semibold">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function HistorySheet({ item }: Readonly<{ item: AdminPricingHistory }>) {
  return (
    <BottomSheet>
      <BottomSheetTrigger asChild>
        <Button variant="ghost" size="sm">
          جزئیات
        </Button>
      </BottomSheetTrigger>
      <BottomSheetContent title={item.title} description="جزئیات تغییر ثبت‌شده در تاریخچه">
        <HistoryDetails item={item} />
      </BottomSheetContent>
    </BottomSheet>
  );
}

export function PricingManagementView({ catalog, failed, canWrite }: PricingManagementViewProps) {
  const products = catalog?.products ?? [];
  const rates = catalog?.platingRates ?? [];
  const history = catalog?.history ?? [];
  const [productQuery, setProductQuery] = useState('');
  const [productFilter, setProductFilter] = useState('all');
  const [historyFilter, setHistoryFilter] = useState('all');

  const priced = products.filter((product) => product.salePriceToman !== null).length;
  const discounted = products.filter(
    (product) => product.salePriceToman !== null && product.compareAtPriceToman !== null,
  ).length;
  const missing = products.length - priced;
  const negativeMargin = products.filter(
    (product) => (productGrossMargin(product) ?? 0) < 0,
  ).length;
  const filteredProducts = useMemo(() => {
    const query = toAsciiDigits(productQuery.trim()).toLocaleLowerCase('fa');
    return products.filter((product) => {
      const matchesQuery =
        !query ||
        `${product.name} ${product.slug} ${product.supplierName ?? ''}`
          .toLocaleLowerCase('fa')
          .includes(query);
      const margin = productGrossMargin(product);
      const matchesFilter =
        productFilter === 'all' ||
        (productFilter === 'missing' && product.salePriceToman === null) ||
        (productFilter === 'discounted' && product.compareAtPriceToman !== null) ||
        (productFilter === 'no-cost' && product.supplierCostToman === null) ||
        (productFilter === 'negative' && margin !== null && margin < 0);
      return matchesQuery && matchesFilter;
    });
  }, [productFilter, productQuery, products]);
  const filteredHistory = useMemo(
    () => history.filter((item) => historyFilter === 'all' || item.kind === historyFilter),
    [history, historyFilter],
  );

  const productColumns: readonly DataTableColumn<AdminPricingProduct>[] = [
    {
      id: 'product',
      header: 'محصول',
      cell: (product) => (
        <div>
          <p className="font-bold">{product.name}</p>
          <div className="mt-1">{productStatus(product.status)}</div>
        </div>
      ),
    },
    {
      id: 'sale',
      header: 'قیمت فروش',
      align: 'center',
      cell: (product) =>
        product.salePriceToman === null ? (
          <span className="text-[var(--admin-color-danger)]">ثبت نشده</span>
        ) : (
          formatAdminToman(product.salePriceToman)
        ),
    },
    {
      id: 'compare',
      header: 'قبل از تخفیف',
      align: 'center',
      cell: (product) =>
        product.compareAtPriceToman === null ? '—' : formatAdminToman(product.compareAtPriceToman),
    },
    {
      id: 'cost',
      header: 'قیمت خرید',
      align: 'center',
      cell: (product) =>
        product.supplierCostToman === null ? (
          '—'
        ) : (
          <div>
            <p>{formatAdminToman(product.supplierCostToman)}</p>
            <p className="mt-1 text-xs text-[var(--admin-color-muted)]">{product.supplierName}</p>
          </div>
        ),
    },
    {
      id: 'margin',
      header: 'حاشیه ناخالص',
      align: 'center',
      cell: (product) => {
        const margin = productGrossMargin(product);
        return margin === null ? (
          '—'
        ) : (
          <span
            className={
              margin < 0
                ? 'font-bold text-[var(--admin-color-danger)]'
                : 'font-bold text-[var(--admin-color-success)]'
            }
          >
            {formatAdminToman(margin)}
          </span>
        );
      },
    },
    {
      id: 'discount',
      header: 'تخفیف',
      align: 'center',
      cell: (product) => {
        const discount = productDiscountPercent(product);
        return discount === null ? '—' : `${formatAdminInteger(discount)}٪`;
      },
    },
    {
      id: 'action',
      header: 'عملیات',
      align: 'end',
      cell: (product) => (
        <ProductPriceSheet
          product={product}
          canWrite={canWrite}
          triggerLabel={canWrite ? 'ویرایش قیمت' : 'مشاهده'}
        />
      ),
    },
  ];
  const historyColumns: readonly DataTableColumn<AdminPricingHistory>[] = [
    {
      id: 'title',
      header: 'مورد',
      cell: (item) => (
        <div>
          <p className="font-bold">{item.title}</p>
          <Badge tone={item.kind === 'PRODUCT' ? 'info' : 'warning'}>
            {item.kind === 'PRODUCT' ? 'محصول' : 'آبکاری'}
          </Badge>
        </div>
      ),
    },
    {
      id: 'previous',
      header: 'مقدار قبلی',
      align: 'center',
      cell: (item) =>
        item.previousPriceToman === null ? 'ثبت نشده' : formatAdminToman(item.previousPriceToman),
    },
    {
      id: 'next',
      header: 'مقدار جدید',
      align: 'center',
      cell: (item) => <strong>{formatAdminToman(item.newPriceToman)}</strong>,
    },
    { id: 'actor', header: 'ثبت‌کننده', cell: (item) => toPersianDigits(item.actor) },
    { id: 'created', header: 'زمان', cell: (item) => formatAdminDateTime(item.createdAt) },
    { id: 'action', header: 'عملیات', align: 'end', cell: (item) => <HistorySheet item={item} /> },
  ];

  if (failed || !catalog)
    return (
      <div className="mt-6">
        <Alert tone="danger" title="دریافت اطلاعات ناموفق بود">
          اطلاعات قیمت‌گذاری از سرور دریافت نشد.
        </Alert>
      </div>
    );

  return (
    <div className="mt-6 space-y-8">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Card>
            <p className="text-xs text-[var(--admin-color-muted)]">محصول قیمت‌گذاری‌شده</p>
            <p className="mt-2 text-2xl font-black text-[var(--admin-color-success)]">
              {formatAdminInteger(priced)}
            </p>
          </Card>
          <Card>
            <p className="text-xs text-[var(--admin-color-muted)]">دارای تخفیف</p>
            <p className="mt-2 text-2xl font-black text-[var(--admin-color-info)]">
              {formatAdminInteger(discounted)}
            </p>
          </Card>
          <Card className={missing ? 'border-amber-200' : undefined}>
            <p className="text-xs text-[var(--admin-color-muted)]">بدون قیمت فروش</p>
            <p className="mt-2 text-2xl font-black text-[var(--admin-color-warning)]">
              {formatAdminInteger(missing)}
            </p>
          </Card>
          <Card className={negativeMargin ? 'border-red-200' : undefined}>
            <p className="text-xs text-[var(--admin-color-muted)]">حاشیه منفی</p>
            <p className="mt-2 text-2xl font-black text-[var(--admin-color-danger)]">
              {formatAdminInteger(negativeMargin)}
            </p>
          </Card>
        </div>
        <Card title="پوشش قیمت‌گذاری" description="وضعیت کل کاتالوگ">
          <DonutChart
            title="پوشش قیمت‌گذاری محصولات"
            centerLabel="محصول"
            segments={[
              {
                label: 'قیمت‌گذاری‌شده',
                value: Math.max(0, priced - discounted),
                color: 'var(--admin-color-success)',
              },
              { label: 'دارای تخفیف', value: discounted, color: 'var(--admin-color-info)' },
              { label: 'بدون قیمت', value: missing, color: 'var(--admin-color-warning)' },
            ]}
          />
        </Card>
      </div>

      <section aria-labelledby="plating-rates-heading" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="plating-rates-heading" className="text-lg font-black">
              نرخ‌های آبکاری
            </h2>
            <p className="mt-1 text-xs text-[var(--admin-color-muted)]">
              نرخ جاری و زمان انجام سرویس‌ها
            </p>
          </div>
          {canWrite ? (
            <ButtonLink href="/plating-settings" variant="outline" size="sm">
              مدیریت نرخ و گزینه‌ها
            </ButtonLink>
          ) : null}
        </div>
        {rates.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {rates.map((rate) => (
              <RateCard key={rate.id} rate={rate} />
            ))}
          </div>
        ) : (
          <Alert tone="warning">هیچ نرخ آبکاری ثبت نشده است.</Alert>
        )}
      </section>

      <section aria-labelledby="product-pricing-heading" className="space-y-4">
        <div>
          <h2 id="product-pricing-heading" className="text-lg font-black">
            قیمت محصولات
          </h2>
          <p className="mt-1 text-xs text-[var(--admin-color-muted)]">
            کنترل سریع قیمت فروش، تخفیف و حاشیه ناخالص
          </p>
        </div>
        <FilterBar
          activeCount={
            [productQuery.trim(), productFilter === 'all' ? '' : productFilter].filter(Boolean)
              .length
          }
          resetAction={
            productQuery.trim() || productFilter !== 'all' ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setProductQuery('');
                  setProductFilter('all');
                }}
              >
                پاک‌کردن فیلترها
              </Button>
            ) : undefined
          }
        >
          <SearchField
            value={productQuery}
            onChange={(event) => setProductQuery(toPersianDigits(event.target.value))}
            placeholder="جستجو در محصول یا تأمین‌کننده"
            aria-label="جستجوی محصول"
          />
          <Select
            value={productFilter}
            onValueChange={setProductFilter}
            aria-label="فیلتر وضعیت قیمت"
            options={[
              { value: 'all', label: 'همه وضعیت‌ها' },
              { value: 'missing', label: 'بدون قیمت فروش' },
              { value: 'discounted', label: 'دارای تخفیف' },
              { value: 'no-cost', label: 'بدون قیمت خرید' },
              { value: 'negative', label: 'حاشیه منفی' },
            ]}
          />
        </FilterBar>
        <ResponsiveDataView
          mobileLabel="کارت‌های قیمت محصول"
          renderMobileCard={(product) => (
            <ProductMobileCard product={product} canWrite={canWrite} />
          )}
          caption="جدول قیمت محصولات"
          columns={productColumns}
          rows={filteredProducts}
          getRowKey={(product) => product.id}
          emptyTitle="محصولی با این فیلتر پیدا نشد"
        />
      </section>

      <section aria-labelledby="pricing-history-heading" className="space-y-4">
        <div>
          <h2 id="pricing-history-heading" className="text-lg font-black">
            تاریخچه تغییرات
          </h2>
          <p className="mt-1 text-xs text-[var(--admin-color-muted)]">
            آخرین تغییرات قیمت محصول و نرخ آبکاری با ثبت عامل تغییر
          </p>
        </div>
        <FilterBar
          activeCount={historyFilter === 'all' ? 0 : 1}
          resetAction={
            historyFilter !== 'all' ? (
              <Button variant="ghost" size="sm" onClick={() => setHistoryFilter('all')}>
                نمایش همه
              </Button>
            ) : undefined
          }
        >
          <Select
            value={historyFilter}
            onValueChange={setHistoryFilter}
            aria-label="فیلتر نوع تاریخچه"
            options={[
              { value: 'all', label: 'همه تغییرات' },
              { value: 'PRODUCT', label: 'قیمت محصول' },
              { value: 'PLATING', label: 'نرخ آبکاری' },
            ]}
          />
        </FilterBar>
        <ResponsiveDataView
          mobileLabel="کارت‌های تاریخچه قیمت"
          renderMobileCard={(item) => (
            <MobileDataCard
              eyebrow={item.kind === 'PRODUCT' ? 'قیمت محصول' : 'نرخ آبکاری'}
              title={item.title}
              status={<Badge tone="neutral">{formatAdminDateTime(item.createdAt)}</Badge>}
              items={[
                {
                  label: 'مقدار قبلی',
                  value:
                    item.previousPriceToman === null
                      ? 'ثبت نشده'
                      : formatAdminToman(item.previousPriceToman),
                },
                { label: 'مقدار جدید', value: formatAdminToman(item.newPriceToman) },
                { label: 'ثبت‌کننده', value: toPersianDigits(item.actor) },
              ]}
              detailsTitle={item.title}
              detailsDescription="جزئیات تغییر قیمت"
              details={<HistoryDetails item={item} />}
            />
          )}
          caption="جدول تاریخچه قیمت‌گذاری"
          columns={historyColumns}
          rows={filteredHistory}
          getRowKey={(item) => `${item.kind}-${item.id}`}
          emptyTitle="تغییری در این بخش ثبت نشده است"
        />
      </section>
    </div>
  );
}
