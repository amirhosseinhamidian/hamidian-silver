import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button, IconButton } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
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
import { Pagination } from '@/components/ui/pagination';
import { Select } from '@/components/ui/select';
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
  status: 'processing' | 'payment-review' | 'ready' | 'blocked';
}>;

const previewOrders: readonly PreviewOrder[] = [
  {
    id: 'HS-1042',
    customer: 'سارا محمدی',
    amount: 8_640_000,
    createdAt: '2026-09-06T08:35:00+03:30',
    status: 'payment-review',
  },
  {
    id: 'HS-1041',
    customer: 'علی رضایی',
    amount: 4_280_000,
    createdAt: '2026-09-06T08:12:00+03:30',
    status: 'processing',
  },
  {
    id: 'HS-1040',
    customer: 'مریم کریمی',
    amount: 12_910_000,
    createdAt: '2026-09-05T19:48:00+03:30',
    status: 'blocked',
  },
  {
    id: 'HS-1039',
    customer: 'رضا احمدی',
    amount: 6_150_000,
    createdAt: '2026-09-05T18:22:00+03:30',
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

export default function AdminHomePage() {
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

      <Alert tone="info" title="Stage 0B آماده بازبینی است" className="mt-6">
        جدول، فیلتر، صفحه‌بندی، منوی عملیات و Dialog از این مرحله در تمام بخش‌های پنل به شکل مشترک
        استفاده می‌شوند.
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

        <DataTable
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
