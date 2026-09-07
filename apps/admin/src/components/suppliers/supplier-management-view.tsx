'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useId, useMemo, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { BottomSheet, BottomSheetContent, BottomSheetTrigger } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import type { DataTableColumn } from '@/components/ui/data-table';
import { FilterBar, SearchField } from '@/components/ui/filter-bar';
import { Input } from '@/components/ui/form-control';
import { FormField } from '@/components/ui/form-field';
import { MobileDataCard } from '@/components/ui/mobile-data-card';
import { ResponsiveDataView } from '@/components/ui/responsive-data-view';
import { Select } from '@/components/ui/select';
import {
  preferredSupplier,
  type AdminSupplier,
  type AdminSupplierProduct,
} from '@/lib/suppliers/suppliers-model';
import {
  formatAdminDateTime,
  formatAdminInteger,
  formatAdminPhone,
  formatAdminToman,
  toAsciiDigits,
  toPersianDigits,
} from '@/lib/presentation/formatters';

type SupplierManagementViewProps = Readonly<{
  suppliers: readonly AdminSupplier[];
  products: readonly AdminSupplierProduct[];
  failed: boolean;
  canWrite: boolean;
}>;

function apiError(payload: unknown): string {
  const translations: Record<string, string> = {
    'Another supplier already uses this code.': 'این کد قبلاً برای تأمین‌کننده دیگری ثبت شده است.',
    'Supplier was not found.': 'تأمین‌کننده پیدا نشد یا دیگر در دسترس نیست.',
    'Product was not found.': 'محصول پیدا نشد یا دیگر در دسترس نیست.',
    'Supplier fields cannot be blank.': 'فیلدهای مشخصات تأمین‌کننده نمی‌توانند خالی باشند.',
  };
  if (typeof payload === 'object' && payload !== null) {
    const value = payload as Record<string, unknown>;
    if (typeof value.message === 'string') return translations[value.message] ?? value.message;
    if (Array.isArray(value.message)) return value.message.join('، ');
    const nested = value.error as Record<string, unknown> | undefined;
    if (typeof nested?.message === 'string') return translations[nested.message] ?? nested.message;
  }
  return 'عملیات تأمین‌کننده انجام نشد. دوباره تلاش کنید.';
}

async function requestJson(path: string, method: 'POST' | 'PATCH' | 'PUT', body: unknown) {
  const response = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) throw new Error(apiError(payload));
  return payload;
}

function normalizeNumericInput(value: string, decimal = false): string {
  const ascii = toAsciiDigits(value)
    .replace(/[٬,\s]/g, '')
    .replace('٫', '.');
  const cleaned = decimal ? ascii.replace(/[^\d.]/g, '') : ascii.replace(/\D/g, '');
  const [whole = '', ...fractionParts] = cleaned.split('.');
  const normalized = decimal
    ? `${whole}${fractionParts.length ? `.${fractionParts.join('').slice(0, 3)}` : ''}`
    : cleaned;
  return toPersianDigits(normalized).replace('.', '٫');
}

function parseNumber(value: string): number | null {
  const normalized = toAsciiDigits(value)
    .replace(/[٬,\s]/g, '')
    .replace('٫', '.');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function supplierStatus(supplier: AdminSupplier) {
  return (
    <Badge tone={supplier.active ? 'success' : 'neutral'} dot>
      {supplier.active ? 'فعال' : 'غیرفعال'}
    </Badge>
  );
}

function productStatus(status: AdminSupplierProduct['status']) {
  if (status === 'ACTIVE') return <Badge tone="success">منتشرشده</Badge>;
  if (status === 'DRAFT') return <Badge tone="warning">پیش‌نویس</Badge>;
  return <Badge tone="neutral">آرشیوشده</Badge>;
}

function SupplierForm({
  formId,
  supplier,
  onSaved,
  onPendingChange,
}: Readonly<{
  formId: string;
  supplier?: AdminSupplier;
  onSaved: () => void;
  onPendingChange: (pending: boolean) => void;
}>) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const code = toAsciiDigits(String(formData.get('code') ?? ''))
      .trim()
      .toUpperCase();
    const name = String(formData.get('name') ?? '').trim();
    const contactName = String(formData.get('contactName') ?? '').trim();
    const phone = toAsciiDigits(String(formData.get('phone') ?? '')).replace(/[\s-]/g, '');
    if (!code || !name) return setError('نام و کد تأمین‌کننده الزامی است.');
    if (phone && !/^\+?\d{5,20}$/.test(phone)) return setError('شماره تماس معتبر نیست.');
    setError(null);
    onPendingChange(true);
    try {
      await requestJson(
        supplier ? `/api/pricing/suppliers/${supplier.id}` : '/api/pricing/suppliers',
        supplier ? 'PATCH' : 'POST',
        {
          code,
          name,
          contactName: contactName || (supplier ? null : undefined),
          phone: phone || (supplier ? null : undefined),
          isActive: formData.get('isActive') === 'on',
        },
      );
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
        <Alert tone="danger" title="ذخیره تأمین‌کننده ناموفق بود">
          {error}
        </Alert>
      ) : null}
      {supplier?.active ? null : supplier ? (
        <Alert tone="warning">تأمین‌کننده غیرفعال برای قیمت‌گذاری جدید قابل انتخاب نیست.</Alert>
      ) : null}
      <FormField id={`${formId}-name`} label="نام تأمین‌کننده" required>
        {(props) => (
          <Input
            {...props}
            name="name"
            defaultValue={supplier?.name}
            placeholder="مثلاً نقره‌سازی پارس"
            required
          />
        )}
      </FormField>
      <FormField id={`${formId}-code`} label="کد تأمین‌کننده" hint="شناسه کوتاه و یکتا" required>
        {(props) => (
          <Input
            {...props}
            name="code"
            defaultValue={supplier ? toPersianDigits(supplier.code) : ''}
            placeholder="مثلاً SUP-01"
            dir="ltr"
            maxLength={64}
            required
          />
        )}
      </FormField>
      <FormField id={`${formId}-contact`} label="نام مسئول ارتباط">
        {(props) => (
          <Input
            {...props}
            name="contactName"
            defaultValue={supplier?.contactName ?? ''}
            placeholder="نام و نام خانوادگی"
          />
        )}
      </FormField>
      <FormField id={`${formId}-phone`} label="شماره تماس">
        {(props) => (
          <Input
            {...props}
            name="phone"
            defaultValue={supplier?.phone ? toPersianDigits(supplier.phone) : ''}
            placeholder="مثلاً ۰۹۱۲۱۲۳۴۵۶۷"
            inputMode="tel"
            dir="ltr"
            onChange={(event) => {
              event.currentTarget.value = toPersianDigits(toAsciiDigits(event.currentTarget.value));
            }}
          />
        )}
      </FormField>
      <Checkbox
        id={`${formId}-active`}
        name="isActive"
        label="تأمین‌کننده فعال باشد"
        description="با غیرفعال‌سازی، اتصال‌های فعال و وضعیت منتخب محصولات نیز غیرفعال می‌شوند."
        defaultChecked={supplier?.active ?? true}
      />
    </form>
  );
}

function SupplierSheet({
  supplier,
  triggerLabel,
}: Readonly<{ supplier?: AdminSupplier; triggerLabel: string }>) {
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  return (
    <BottomSheet open={open} onOpenChange={setOpen}>
      <BottomSheetTrigger asChild>
        <Button variant={supplier ? 'outline' : 'primary'} size="sm">
          {triggerLabel}
        </Button>
      </BottomSheetTrigger>
      <BottomSheetContent
        title={supplier ? `ویرایش ${supplier.name}` : 'افزودن تأمین‌کننده'}
        description="مشخصات ارتباطی و وضعیت همکاری را ثبت کنید."
        footer={
          <>
            <Button variant="outline" disabled={pending} onClick={() => setOpen(false)}>
              انصراف
            </Button>
            <Button type="submit" form={formId} loading={pending}>
              ذخیره تأمین‌کننده
            </Button>
          </>
        }
      >
        <SupplierForm
          formId={formId}
          supplier={supplier}
          onSaved={() => setOpen(false)}
          onPendingChange={setPending}
        />
      </BottomSheetContent>
    </BottomSheet>
  );
}

function ProductSupplierForm({
  formId,
  product,
  suppliers,
  onSaved,
  onPendingChange,
}: Readonly<{
  formId: string;
  product: AdminSupplierProduct;
  suppliers: readonly AdminSupplier[];
  onSaved: () => void;
  onPendingChange: (pending: boolean) => void;
}>) {
  const router = useRouter();
  const selectableSuppliers = suppliers.filter((supplier) => supplier.active);
  const initialLink =
    product.suppliers.find((link) => link.preferred && link.supplierActive) ??
    product.suppliers.find((link) => link.supplierActive);
  const initialSupplierId = initialLink?.supplierId ?? selectableSuppliers[0]?.id ?? '';
  const [supplierId, setSupplierId] = useState(initialSupplierId);
  const [price, setPrice] = useState(
    initialLink ? toPersianDigits(initialLink.supplierPriceToman) : '',
  );
  const [markup, setMarkup] = useState(
    initialLink?.markupPercent === null || initialLink?.markupPercent === undefined
      ? ''
      : toPersianDigits(initialLink.markupPercent).replace('.', '٫'),
  );
  const [active, setActive] = useState(initialLink?.active ?? true);
  const [preferred, setPreferred] = useState(initialLink?.preferred ?? false);
  const [error, setError] = useState<string | null>(null);

  function selectSupplier(value: string) {
    setSupplierId(value);
    const link = product.suppliers.find((item) => item.supplierId === value);
    setPrice(link ? toPersianDigits(link.supplierPriceToman) : '');
    setMarkup(
      link?.markupPercent === null || link?.markupPercent === undefined
        ? ''
        : toPersianDigits(link.markupPercent).replace('.', '٫'),
    );
    setActive(link?.active ?? true);
    setPreferred(link?.preferred ?? false);
    setError(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedPrice = parseNumber(price);
    const parsedMarkup = parseNumber(markup);
    if (!supplierId) return setError('یک تأمین‌کننده انتخاب کنید.');
    if (parsedPrice === null || !Number.isInteger(parsedPrice) || parsedPrice < 0)
      return setError('قیمت خرید باید یک عدد صحیح صفر یا بزرگ‌تر باشد.');
    if (markup && (parsedMarkup === null || parsedMarkup < 0 || parsedMarkup > 10000))
      return setError('درصد افزایش باید بین صفر تا ۱۰٬۰۰۰ باشد.');
    setError(null);
    onPendingChange(true);
    try {
      await requestJson(`/api/pricing/products/${product.id}/suppliers/${supplierId}`, 'PUT', {
        supplierPriceToman: parsedPrice,
        markupPercent: markup ? parsedMarkup : null,
        isPreferred: active && preferred,
        isActive: active,
      });
      onSaved();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : apiError(null));
    } finally {
      onPendingChange(false);
    }
  }

  if (!selectableSuppliers.length)
    return (
      <Alert tone="warning" title="تأمین‌کننده فعالی وجود ندارد">
        ابتدا یک تأمین‌کننده فعال بسازید.
      </Alert>
    );
  return (
    <form id={formId} onSubmit={(event) => void submit(event)} className="space-y-4">
      {error ? (
        <Alert tone="danger" title="ذخیره قیمت خرید ناموفق بود">
          {error}
        </Alert>
      ) : null}
      <FormField id={`${formId}-supplier`} label="تأمین‌کننده" required>
        {(props) => (
          <Select
            {...props}
            value={supplierId}
            onValueChange={selectSupplier}
            options={selectableSuppliers.map((supplier) => ({
              value: supplier.id,
              label: `${supplier.name} — ${toPersianDigits(supplier.code)}`,
            }))}
            required
          />
        )}
      </FormField>
      <FormField id={`${formId}-price`} label="قیمت خرید" hint="مبلغ به تومان" required>
        {(props) => (
          <Input
            {...props}
            value={price}
            onChange={(event) => setPrice(normalizeNumericInput(event.target.value))}
            placeholder="مثلاً ۸۵۰٬۰۰۰"
            inputMode="numeric"
            required
          />
        )}
      </FormField>
      <FormField id={`${formId}-markup`} label="درصد افزایش قیمت" hint="اختیاری؛ تا سه رقم اعشار">
        {(props) => (
          <Input
            {...props}
            value={markup}
            onChange={(event) => setMarkup(normalizeNumericInput(event.target.value, true))}
            placeholder="مثلاً ۲۵"
            inputMode="decimal"
          />
        )}
      </FormField>
      <Checkbox
        id={`${formId}-active`}
        label="این اتصال فعال باشد"
        checked={active}
        onChange={(event) => {
          setActive(event.target.checked);
          if (!event.target.checked) setPreferred(false);
        }}
      />
      <Checkbox
        id={`${formId}-preferred`}
        label="تأمین‌کننده منتخب این محصول"
        description="در سفارش‌های جدید این قیمت خرید ثبت می‌شود."
        checked={preferred}
        disabled={!active}
        onChange={(event) => setPreferred(event.target.checked)}
      />
    </form>
  );
}

function ProductSupplierSheet({
  product,
  suppliers,
  triggerLabel,
}: Readonly<{
  product: AdminSupplierProduct;
  suppliers: readonly AdminSupplier[];
  triggerLabel: string;
}>) {
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
        description="قیمت خرید، درصد افزایش و منبع منتخب محصول را مدیریت کنید."
        height="large"
        footer={
          <>
            <Button variant="outline" disabled={pending} onClick={() => setOpen(false)}>
              انصراف
            </Button>
            <Button type="submit" form={formId} loading={pending}>
              ذخیره منبع تأمین
            </Button>
          </>
        }
      >
        <ProductSupplierForm
          formId={formId}
          product={product}
          suppliers={suppliers}
          onSaved={() => setOpen(false)}
          onPendingChange={setPending}
        />
      </BottomSheetContent>
    </BottomSheet>
  );
}

function SupplierReadonlyDetails({
  supplier,
  products,
}: Readonly<{ supplier: AdminSupplier; products: readonly AdminSupplierProduct[] }>) {
  const links = products.flatMap((product) =>
    product.suppliers.filter((link) => link.supplierId === supplier.id),
  );
  return (
    <dl className="divide-y divide-[var(--admin-color-border)]">
      {[
        ['نام', supplier.name],
        ['کد', toPersianDigits(supplier.code)],
        ['مسئول ارتباط', supplier.contactName ?? 'ثبت نشده'],
        ['تلفن', supplier.phone ? formatAdminPhone(supplier.phone) : 'ثبت نشده'],
        ['محصول متصل', formatAdminInteger(links.length)],
        [
          'تأمین منتخب',
          formatAdminInteger(links.filter((link) => link.preferred && link.active).length),
        ],
        ['آخرین تغییر', formatAdminDateTime(supplier.updatedAt)],
      ].map(([label, value]) => (
        <div key={label} className="flex justify-between gap-4 py-3 text-sm">
          <dt className="text-[var(--admin-color-muted)]">{label}</dt>
          <dd className="max-w-[65%] text-left font-semibold">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ProductReadonlyDetails({ product }: Readonly<{ product: AdminSupplierProduct }>) {
  const preferred = preferredSupplier(product);
  return (
    <dl className="divide-y divide-[var(--admin-color-border)]">
      {[
        ['محصول', product.name],
        [
          'وضعیت',
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
          'تأمین‌کنندگان فعال',
          formatAdminInteger(
            product.suppliers.filter((link) => link.active && link.supplierActive).length,
          ),
        ],
        ['تأمین‌کننده منتخب', preferred?.supplierName ?? 'انتخاب نشده'],
        [
          'قیمت خرید منتخب',
          preferred ? formatAdminToman(preferred.supplierPriceToman) : 'ثبت نشده',
        ],
      ].map(([label, value]) => (
        <div key={label} className="flex justify-between gap-4 py-3 text-sm">
          <dt className="text-[var(--admin-color-muted)]">{label}</dt>
          <dd className="max-w-[65%] text-left font-semibold">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function SupplierMobileCard({
  supplier,
  products,
  canWrite,
}: Readonly<{
  supplier: AdminSupplier;
  products: readonly AdminSupplierProduct[];
  canWrite: boolean;
}>) {
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const links = products.flatMap((product) =>
    product.suppliers.filter((link) => link.supplierId === supplier.id),
  );
  return (
    <MobileDataCard
      eyebrow={toPersianDigits(supplier.code)}
      title={supplier.name}
      status={supplierStatus(supplier)}
      items={[
        { label: 'مسئول ارتباط', value: supplier.contactName ?? 'ثبت نشده' },
        { label: 'محصول متصل', value: formatAdminInteger(links.length) },
        {
          label: 'تأمین منتخب',
          value: formatAdminInteger(links.filter((link) => link.preferred && link.active).length),
        },
      ]}
      detailsTitle={supplier.name}
      detailsDescription="مشخصات و وضعیت همکاری"
      detailsOpen={open}
      onDetailsOpenChange={setOpen}
      details={
        canWrite ? (
          <SupplierForm
            formId={formId}
            supplier={supplier}
            onSaved={() => setOpen(false)}
            onPendingChange={setPending}
          />
        ) : (
          <SupplierReadonlyDetails supplier={supplier} products={products} />
        )
      }
      detailsFooter={
        canWrite ? (
          <Button type="submit" form={formId} loading={pending}>
            ذخیره تغییرات
          </Button>
        ) : undefined
      }
    />
  );
}

function ProductMobileCard({
  product,
  suppliers,
  canWrite,
}: Readonly<{
  product: AdminSupplierProduct;
  suppliers: readonly AdminSupplier[];
  canWrite: boolean;
}>) {
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const preferred = preferredSupplier(product);
  return (
    <MobileDataCard
      eyebrow={productStatus(product.status)}
      title={product.name}
      status={
        preferred ? (
          <Badge tone="success" dot>
            منبع منتخب
          </Badge>
        ) : (
          <Badge tone="warning" dot>
            بدون منبع
          </Badge>
        )
      }
      items={[
        { label: 'تأمین‌کننده', value: preferred?.supplierName ?? 'انتخاب نشده' },
        {
          label: 'قیمت خرید',
          value: preferred ? formatAdminToman(preferred.supplierPriceToman) : '—',
        },
        {
          label: 'قیمت فروش',
          value: product.salePriceToman === null ? '—' : formatAdminToman(product.salePriceToman),
        },
      ]}
      detailsTitle={product.name}
      detailsDescription="جزئیات قیمت خرید و منبع تأمین"
      detailsOpen={open}
      onDetailsOpenChange={setOpen}
      details={
        canWrite ? (
          <ProductSupplierForm
            formId={formId}
            product={product}
            suppliers={suppliers}
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
            ذخیره منبع تأمین
          </Button>
        ) : undefined
      }
    />
  );
}

export function SupplierManagementView({
  suppliers,
  products,
  failed,
  canWrite,
}: SupplierManagementViewProps) {
  const [supplierQuery, setSupplierQuery] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [productQuery, setProductQuery] = useState('');
  const [productFilter, setProductFilter] = useState('all');
  const supplierLinks = useMemo(() => products.flatMap((product) => product.suppliers), [products]);
  const filteredSuppliers = useMemo(
    () =>
      suppliers.filter((supplier) => {
        const query = toAsciiDigits(supplierQuery.trim()).toLocaleLowerCase('fa');
        const haystack =
          `${supplier.name} ${supplier.code} ${supplier.contactName ?? ''} ${supplier.phone ?? ''}`.toLocaleLowerCase(
            'fa',
          );
        return (
          (!query || haystack.includes(query)) &&
          (supplierFilter === 'all' ||
            (supplierFilter === 'active' ? supplier.active : !supplier.active))
        );
      }),
    [supplierFilter, supplierQuery, suppliers],
  );
  const filteredProducts = useMemo(
    () =>
      products.filter((product) => {
        const query = toAsciiDigits(productQuery.trim()).toLocaleLowerCase('fa');
        const preferred = preferredSupplier(product);
        const activeCount = product.suppliers.filter(
          (link) => link.active && link.supplierActive,
        ).length;
        const haystack =
          `${product.name} ${product.slug} ${product.suppliers.map((link) => `${link.supplierName} ${link.supplierCode}`).join(' ')}`.toLocaleLowerCase(
            'fa',
          );
        const matchesFilter =
          productFilter === 'all' ||
          (productFilter === 'missing' && !preferred) ||
          (productFilter === 'preferred' && preferred) ||
          (productFilter === 'multiple' && activeCount > 1);
        return (!query || haystack.includes(query)) && matchesFilter;
      }),
    [productFilter, productQuery, products],
  );
  const supplierColumns: readonly DataTableColumn<AdminSupplier>[] = [
    {
      id: 'supplier',
      header: 'تأمین‌کننده',
      cell: (supplier) => (
        <div>
          <p className="font-bold">{supplier.name}</p>
          <p className="mt-1 text-xs text-[var(--admin-color-muted)]">
            {toPersianDigits(supplier.code)}
          </p>
        </div>
      ),
    },
    {
      id: 'contact',
      header: 'ارتباط',
      cell: (supplier) => (
        <div>
          <p>{supplier.contactName ?? 'ثبت نشده'}</p>
          <p className="mt-1 text-xs text-[var(--admin-color-muted)]">
            {supplier.phone ? formatAdminPhone(supplier.phone) : 'بدون شماره'}
          </p>
        </div>
      ),
    },
    {
      id: 'products',
      header: 'محصول',
      cell: (supplier) =>
        formatAdminInteger(supplierLinks.filter((link) => link.supplierId === supplier.id).length),
      align: 'center',
    },
    {
      id: 'preferred',
      header: 'منتخب',
      cell: (supplier) =>
        formatAdminInteger(
          supplierLinks.filter(
            (link) =>
              link.supplierId === supplier.id &&
              link.preferred &&
              link.active &&
              link.supplierActive,
          ).length,
        ),
      align: 'center',
    },
    { id: 'status', header: 'وضعیت', cell: supplierStatus },
    {
      id: 'action',
      header: 'عملیات',
      cell: (supplier) =>
        canWrite ? (
          <SupplierSheet supplier={supplier} triggerLabel="ویرایش" />
        ) : (
          <span className="text-xs text-[var(--admin-color-subtle)]">فقط مشاهده</span>
        ),
      align: 'end',
    },
  ];
  const productColumns: readonly DataTableColumn<AdminSupplierProduct>[] = [
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
      id: 'supplier',
      header: 'تأمین‌کننده منتخب',
      cell: (product) =>
        preferredSupplier(product)?.supplierName ?? (
          <span className="text-[var(--admin-color-danger)]">انتخاب نشده</span>
        ),
    },
    {
      id: 'cost',
      header: 'قیمت خرید',
      cell: (product) => {
        const preferred = preferredSupplier(product);
        return preferred ? formatAdminToman(preferred.supplierPriceToman) : '—';
      },
      align: 'center',
    },
    {
      id: 'sale',
      header: 'قیمت فروش',
      cell: (product) =>
        product.salePriceToman === null ? 'ثبت نشده' : formatAdminToman(product.salePriceToman),
      align: 'center',
    },
    {
      id: 'margin',
      header: 'فاصله قیمت',
      cell: (product) => {
        const preferred = preferredSupplier(product);
        if (!preferred || product.salePriceToman === null) return '—';
        const margin = product.salePriceToman - preferred.supplierPriceToman;
        return (
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
      align: 'center',
    },
    {
      id: 'action',
      header: 'عملیات',
      cell: (product) =>
        canWrite ? (
          <ProductSupplierSheet
            product={product}
            suppliers={suppliers}
            triggerLabel="مدیریت تأمین"
          />
        ) : (
          <span className="text-xs text-[var(--admin-color-subtle)]">فقط مشاهده</span>
        ),
      align: 'end',
    },
  ];

  if (failed)
    return (
      <div className="mt-6">
        <Alert tone="danger" title="دریافت اطلاعات ناموفق بود">
          اطلاعات تأمین‌کنندگان و محصولات از سرور دریافت نشد.
        </Alert>
      </div>
    );
  return (
    <div className="mt-6 space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <p className="text-xs text-[var(--admin-color-muted)]">تأمین‌کننده فعال</p>
          <p className="mt-2 text-2xl font-black">
            {formatAdminInteger(suppliers.filter((supplier) => supplier.active).length)}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-[var(--admin-color-muted)]">محصول دارای منبع</p>
          <p className="mt-2 text-2xl font-black text-[var(--admin-color-success)]">
            {formatAdminInteger(products.filter((product) => preferredSupplier(product)).length)}
          </p>
        </Card>
        <Card
          className={
            products.some((product) => !preferredSupplier(product)) ? 'border-amber-200' : undefined
          }
        >
          <p className="text-xs text-[var(--admin-color-muted)]">بدون منبع منتخب</p>
          <p className="mt-2 text-2xl font-black text-[var(--admin-color-warning)]">
            {formatAdminInteger(products.filter((product) => !preferredSupplier(product)).length)}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-[var(--admin-color-muted)]">اتصال فعال</p>
          <p className="mt-2 text-2xl font-black">
            {formatAdminInteger(
              supplierLinks.filter((link) => link.active && link.supplierActive).length,
            )}
          </p>
        </Card>
      </div>

      <section aria-labelledby="supplier-directory-heading" className="space-y-4">
        <div>
          <h2 id="supplier-directory-heading" className="text-lg font-black">
            فهرست تأمین‌کنندگان
          </h2>
          <p className="mt-1 text-xs text-[var(--admin-color-muted)]">
            مشخصات ارتباطی و وضعیت همکاری
          </p>
        </div>
        <FilterBar
          actions={canWrite ? <SupplierSheet triggerLabel="افزودن تأمین‌کننده" /> : null}
          activeCount={
            [supplierQuery.trim(), supplierFilter === 'all' ? '' : supplierFilter].filter(Boolean)
              .length
          }
          resetAction={
            supplierQuery.trim() || supplierFilter !== 'all' ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSupplierQuery('');
                  setSupplierFilter('all');
                }}
              >
                پاک‌کردن فیلترها
              </Button>
            ) : undefined
          }
        >
          <SearchField
            value={supplierQuery}
            onChange={(event) => setSupplierQuery(toPersianDigits(event.target.value))}
            placeholder="جستجو در نام، کد یا شماره"
            aria-label="جستجوی تأمین‌کننده"
          />
          <Select
            value={supplierFilter}
            onValueChange={setSupplierFilter}
            aria-label="فیلتر وضعیت تأمین‌کننده"
            options={[
              { value: 'all', label: 'همه وضعیت‌ها' },
              { value: 'active', label: 'فعال' },
              { value: 'inactive', label: 'غیرفعال' },
            ]}
          />
        </FilterBar>
        <ResponsiveDataView
          mobileLabel="کارت‌های تأمین‌کننده"
          renderMobileCard={(supplier) => (
            <SupplierMobileCard supplier={supplier} products={products} canWrite={canWrite} />
          )}
          caption="جدول تأمین‌کنندگان"
          columns={supplierColumns}
          rows={filteredSuppliers}
          getRowKey={(supplier) => supplier.id}
          emptyTitle="تأمین‌کننده‌ای پیدا نشد"
          emptyDescription="فیلترها را تغییر دهید یا تأمین‌کننده جدید بسازید."
          compact
        />
      </section>

      <section aria-labelledby="product-sourcing-heading" className="space-y-4">
        <div>
          <h2 id="product-sourcing-heading" className="text-lg font-black">
            منبع تأمین محصولات
          </h2>
          <p className="mt-1 text-xs text-[var(--admin-color-muted)]">
            قیمت خرید و تأمین‌کننده منتخب هر محصول
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
            aria-label="جستجوی منبع تأمین محصول"
          />
          <Select
            value={productFilter}
            onValueChange={setProductFilter}
            aria-label="فیلتر منبع تأمین"
            options={[
              { value: 'all', label: 'همه محصولات' },
              { value: 'missing', label: 'بدون منبع منتخب' },
              { value: 'preferred', label: 'دارای منبع منتخب' },
              { value: 'multiple', label: 'چند تأمین‌کننده فعال' },
            ]}
          />
        </FilterBar>
        <ResponsiveDataView
          mobileLabel="کارت‌های منبع تأمین محصول"
          renderMobileCard={(product) => (
            <ProductMobileCard product={product} suppliers={suppliers} canWrite={canWrite} />
          )}
          caption="جدول منبع تأمین محصولات"
          columns={productColumns}
          rows={filteredProducts}
          getRowKey={(product) => product.id}
          emptyTitle="محصولی پیدا نشد"
          emptyDescription="فیلترها را تغییر دهید."
          compact
        />
      </section>
    </div>
  );
}
