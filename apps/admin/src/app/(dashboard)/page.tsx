import type { ReactNode } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { BottomSheetClose } from '@/components/ui/bottom-sheet';
import { Button, IconButton } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { DataTableColumn } from '@/components/ui/data-table';
import { Dialog, DialogClose, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FilterBar, SearchField } from '@/components/ui/filter-bar';
import { MobileDataCard } from '@/components/ui/mobile-data-card';
import { Pagination } from '@/components/ui/pagination';
import { ResponsiveDataView } from '@/components/ui/responsive-data-view';
import { Select } from '@/components/ui/select';
import { requireAdminSession } from '@/lib/auth/session';
import {
  formatAdminDateTime,
  formatAdminInteger,
  formatAdminToman,
  toPersianDigits,
} from '@/lib/presentation/formatters';

type PreviewOrder = Readonly<{
  id: string;
  customer: string;
  amount: number;
  createdAt: string;
  phone: string;
  itemCount: number;
  shippingMethod: string;
  status: 'processing' | 'payment-review' | 'ready' | 'blocked';
}>;

const previewOrders: readonly PreviewOrder[] = [
  {
    id: 'HS-1042',
    customer: 'سارا محمدی',
    amount: 8_640_000,
    createdAt: '2026-09-06T08:35:00+03:30',
    phone: '09121234567',
    itemCount: 3,
    shippingMethod: 'پست پیشتاز',
    status: 'payment-review',
  },
  {
    id: 'HS-1041',
    customer: 'علی رضایی',
    amount: 4_280_000,
    createdAt: '2026-09-06T08:12:00+03:30',
    phone: '09123334455',
    itemCount: 1,
    shippingMethod: 'تیپاکس',
    status: 'processing',
  },
  {
    id: 'HS-1040',
    customer: 'مریم کریمی',
    amount: 12_910_000,
    createdAt: '2026-09-05T19:48:00+03:30',
    phone: '09351234567',
    itemCount: 4,
    shippingMethod: 'پست پیشتاز',
    status: 'blocked',
  },
  {
    id: 'HS-1039',
    customer: 'رضا احمدی',
    amount: 6_150_000,
    createdAt: '2026-09-05T18:22:00+03:30',
    phone: '09901234567',
    itemCount: 2,
    shippingMethod: 'تحویل حضوری',
    status: 'ready',
  },
];

const statusPresentation = {
  processing: { label: 'در حال پردازش', tone: 'info' as const },
  'payment-review': { label: 'بررسی پرداخت', tone: 'warning' as const },
  ready: { label: 'آماده ارسال', tone: 'success' as const },
  blocked: { label: 'متوقف‌شده', tone: 'danger' as const },
};

function OrderActions({ orderId }: Readonly<{ orderId: string }>) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton label={`عملیات سفارش ${toPersianDigits(orderId)}`} variant="ghost" size="sm">
          <span className="text-lg leading-none">•••</span>
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>{toPersianDigits(orderId)}</DropdownMenuLabel>
        <DropdownMenuItem shortcut="↵">مشاهده جزئیات</DropdownMenuItem>
        <DropdownMenuItem>تغییر وضعیت</DropdownMenuItem>
        <DropdownMenuItem>ثبت کد رهگیری</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem tone="danger">لغو سفارش</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function OrderMobileCard({ order }: Readonly<{ order: PreviewOrder }>) {
  const status = statusPresentation[order.status];

  return (
    <MobileDataCard
      eyebrow={
        <span dir="ltr" className="inline-block">
          {toPersianDigits(order.id)}
        </span>
      }
      title={order.customer}
      status={
        <Badge tone={status.tone} dot>
          {status.label}
        </Badge>
      }
      items={[
        { label: 'مبلغ', value: formatAdminToman(order.amount) },
        { label: 'تعداد کالا', value: `${formatAdminInteger(order.itemCount)} عدد` },
      ]}
      detailsTitle={`سفارش ${toPersianDigits(order.id)}`}
      detailsDescription="اطلاعات کامل و عملیات سریع سفارش"
      details={
        <dl className="divide-y divide-[var(--admin-color-border)]">
          <OrderDetail label="مشتری" value={order.customer} />
          <OrderDetail label="شماره همراه" value={toPersianDigits(order.phone)} direction="ltr" />
          <OrderDetail label="زمان ثبت" value={formatAdminDateTime(order.createdAt)} />
          <OrderDetail label="مبلغ سفارش" value={formatAdminToman(order.amount)} />
          <OrderDetail label="تعداد کالا" value={`${formatAdminInteger(order.itemCount)} عدد`} />
          <OrderDetail label="روش ارسال" value={order.shippingMethod} />
          <OrderDetail
            label="وضعیت"
            value={
              <Badge tone={status.tone} dot>
                {status.label}
              </Badge>
            }
          />
        </dl>
      }
      detailsFooter={
        <>
          <BottomSheetClose asChild>
            <Button variant="outline">بستن</Button>
          </BottomSheetClose>
          <Button>مشاهده سفارش</Button>
        </>
      }
    />
  );
}

function OrderDetail({
  label,
  value,
  direction,
}: Readonly<{ label: string; value: ReactNode; direction?: 'rtl' | 'ltr' }>) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <dt className="text-xs text-[var(--admin-color-muted)]">{label}</dt>
      <dd className="text-end text-sm font-semibold" dir={direction}>
        {value}
      </dd>
    </div>
  );
}

const orderColumns: readonly DataTableColumn<PreviewOrder>[] = [
  {
    id: 'order',
    header: 'سفارش',
    cell: (order) => (
      <span className="font-bold" dir="ltr">
        {toPersianDigits(order.id)}
      </span>
    ),
  },
  { id: 'customer', header: 'مشتری', cell: (order) => order.customer },
  {
    id: 'createdAt',
    header: 'زمان ثبت',
    visibility: 'md',
    cell: (order) => (
      <span className="whitespace-nowrap text-[var(--admin-color-muted)]">
        {formatAdminDateTime(order.createdAt)}
      </span>
    ),
  },
  {
    id: 'amount',
    header: 'مبلغ',
    align: 'end',
    visibility: 'sm',
    cell: (order) => (
      <span className="whitespace-nowrap font-semibold">{formatAdminToman(order.amount)}</span>
    ),
  },
  {
    id: 'status',
    header: 'وضعیت',
    cell: (order) => {
      const status = statusPresentation[order.status];
      return (
        <Badge tone={status.tone} dot>
          {status.label}
        </Badge>
      );
    },
  },
  {
    id: 'actions',
    header: <span className="sr-only">عملیات</span>,
    align: 'end',
    className: 'w-12',
    cell: (order) => <OrderActions orderId={order.id} />,
  },
];

export default async function AdminHomePage() {
  await requireAdminSession();

  return (
    <main className="admin-container py-8 sm:py-10">
      <header className="flex flex-col gap-4 border-b border-[var(--admin-color-border)] pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold tracking-wider text-[var(--admin-color-primary)]">
            HAMIDIAN ADMIN
          </p>
          <h1 className="mt-2 text-2xl font-bold sm:text-3xl">پنل مدیریت نقره حمیدیان</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--admin-color-muted)]">
            پیش‌نمایش الگوهای عملیاتی؛ داده‌های این صفحه نمونه هستند.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline">خروجی سفارش‌ها</Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button>ثبت عملیات جدید</Button>
            </DialogTrigger>
            <DialogContent
              title="ثبت عملیات سفارش"
              description="این Dialog نمونه الگوی مشترک فرم‌ها و تأیید عملیات در پنل است."
              footer={
                <>
                  <DialogClose asChild>
                    <Button variant="outline">انصراف</Button>
                  </DialogClose>
                  <Button>ثبت عملیات</Button>
                </>
              }
            >
              <Alert tone="warning" title="قبل از ثبت بررسی کنید">
                عملیات حساس باید همراه با نتیجه سرور، loading state و پیام موفقیت یا خطا نمایش داده
                شوند.
              </Alert>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <Alert tone="info" title="الگوی نمایش عملیاتی آماده است" className="mt-6">
        در موبایل سفارش‌ها به کارت‌های فشرده تبدیل می‌شوند و جزئیات کامل داخل Bottom Sheet در دسترس
        است؛ از تبلت به بالا جدول نمایش داده می‌شود.
      </Alert>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card title="نیازمند اقدام" description="سفارش و عملیات متوقف‌شده">
          <p className="text-2xl font-bold tabular-nums">{formatAdminInteger(8)}</p>
          <Badge tone="danger" dot className="mt-3">
            اقدام فوری
          </Badge>
        </Card>
        <Card title="بررسی پرداخت" description="پرداخت‌های نامشخص">
          <p className="text-2xl font-bold tabular-nums">{formatAdminInteger(3)}</p>
          <Badge tone="warning" dot className="mt-3">
            صف مالی
          </Badge>
        </Card>
        <Card title="آماده ارسال" description="قابل تحویل به پست">
          <p className="text-2xl font-bold tabular-nums">{formatAdminInteger(12)}</p>
          <Badge tone="success" dot className="mt-3">
            آماده عملیات
          </Badge>
        </Card>
        <Card title="فروش امروز" description="مبلغ نمونه">
          <p className="text-xl font-bold tabular-nums">{formatAdminToman(42_860_000)}</p>
          <p className="mt-3 text-xs text-[var(--admin-color-muted)]">آخرین بروزرسانی: همین حالا</p>
        </Card>
      </div>

      <section aria-labelledby="orders-preview-title" className="mt-6">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="orders-preview-title" className="text-lg font-bold">
              صف عملیات سفارش‌ها
            </h2>
            <p className="mt-1 text-xs text-[var(--admin-color-muted)]">
              اطلاعات نمونه برای ارزیابی تراکم و دسترسی سریع
            </p>
          </div>
          <Badge tone="neutral">{formatAdminInteger(86)} سفارش</Badge>
        </div>

        <FilterBar
          activeCount={2}
          resetAction={
            <Button variant="ghost" size="sm">
              پاک‌کردن فیلترها
            </Button>
          }
          className="mb-3"
        >
          <SearchField aria-label="جستجوی سفارش" placeholder="شماره سفارش، نام یا موبایل مشتری" />
          <Select
            aria-label="وضعیت سفارش"
            defaultValue="action-required"
            options={[
              { value: 'all', label: 'همه وضعیت‌ها' },
              { value: 'action-required', label: 'نیازمند اقدام' },
              { value: 'processing', label: 'در حال پردازش' },
              { value: 'ready', label: 'آماده ارسال' },
            ]}
          />
          <Select
            aria-label="بازه زمانی"
            defaultValue="today"
            options={[
              { value: 'today', label: 'امروز' },
              { value: 'week', label: '۷ روز اخیر' },
              { value: 'month', label: '۳۰ روز اخیر' },
            ]}
          />
        </FilterBar>

        <ResponsiveDataView
          mobileLabel="کارت‌های سفارش"
          renderMobileCard={(order) => <OrderMobileCard order={order} />}
          caption="فهرست سفارش‌های نمونه"
          columns={orderColumns}
          rows={previewOrders}
          getRowKey={(order) => order.id}
          compact
          footer={
            <Pagination
              currentPage={3}
              totalPages={9}
              totalItems={86}
              pageSize={10}
              getPageHref={(page) => `?page=${page}`}
            />
          }
          getRowClassName={(order) =>
            order.status === 'blocked' ? 'bg-[var(--admin-color-danger-soft)]/40' : undefined
          }
        />
      </section>
    </main>
  );
}
