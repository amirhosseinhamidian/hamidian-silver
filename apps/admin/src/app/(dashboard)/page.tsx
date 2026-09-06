import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input, Textarea } from '@/components/ui/form-control';
import { FormField } from '@/components/ui/form-field';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { formatAdminInteger, formatAdminToman } from '@/lib/presentation/formatters';

const statusExamples = [
  { label: 'فعال', tone: 'success' as const },
  { label: 'نیازمند بررسی', tone: 'warning' as const },
  { label: 'متوقف', tone: 'danger' as const },
  { label: 'در حال پردازش', tone: 'info' as const },
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
            پیش‌نمایش زیرساخت رابط عملیاتی؛ داده‌های این صفحه نمونه هستند.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline">خروجی گزارش</Button>
          <Button>ثبت عملیات جدید</Button>
        </div>
      </header>

      <Alert tone="info" title="Stage 0A آماده بازبینی است" className="mt-6">
        این صفحه فقط زبان بصری، تراکم کنترل‌ها و وضعیت‌های پایه را نمایش می‌دهد و در مرحله داشبورد
        با داده واقعی جایگزین می‌شود.
      </Alert>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Card title="سفارش‌های نیازمند اقدام" description="نمونه کارت عملیاتی فشرده">
          <p className="text-3xl font-bold tabular-nums">{formatAdminInteger(24)}</p>
          <p className="mt-2 text-xs text-[var(--admin-color-muted)]">
            به‌روزرسانی در چند لحظه پیش
          </p>
        </Card>
        <Card title="مبلغ قابل تسویه" description="نمونه نمایش عدد مالی">
          <p className="text-2xl font-bold tabular-nums">{formatAdminToman(18_640_000)}</p>
          <Badge tone="warning" dot className="mt-3">
            نیازمند تأیید مالی
          </Badge>
        </Card>
        <Card title="موجودی بحرانی" description="رنگ همیشه همراه متن استفاده می‌شود">
          <p className="text-3xl font-bold tabular-nums">{formatAdminInteger(6)}</p>
          <Badge tone="danger" dot className="mt-3">
            اقدام فوری
          </Badge>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Card title="کنترل‌های فرم" description="مناسب فرم‌های ایجاد و ویرایش سریع">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="foundation-title" label="عنوان محصول" required>
              {(props) => <Input {...props} placeholder="مثلاً انگشتر نقره" />}
            </FormField>
            <FormField id="foundation-status" label="وضعیت انتشار">
              {(props) => (
                <Select
                  {...props}
                  defaultValue="draft"
                  options={[
                    { value: 'draft', label: 'پیش‌نویس' },
                    { value: 'published', label: 'منتشرشده' },
                    { value: 'archived', label: 'آرشیوشده' },
                  ]}
                />
              )}
            </FormField>
            <FormField
              id="foundation-sku"
              label="شناسه کالا"
              error="این شناسه قبلاً استفاده شده است."
            >
              {(props) => <Input {...props} defaultValue="HS-1001" />}
            </FormField>
            <FormField id="foundation-note" label="یادداشت عملیاتی" className="sm:col-span-2">
              {(props) => <Textarea {...props} placeholder="توضیحات موردنیاز تیم عملیات" />}
            </FormField>
            <Checkbox
              id="foundation-active"
              defaultChecked
              label="محصول فعال باشد"
              description="در صورت غیرفعال‌سازی، محصول در فروشگاه نمایش داده نمی‌شود."
            />
          </div>
          <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-[var(--admin-color-border)] pt-4">
            <Button variant="ghost">انصراف</Button>
            <Button variant="outline">ذخیره پیش‌نویس</Button>
            <Button>ذخیره و انتشار</Button>
          </div>
        </Card>

        <Card title="وضعیت‌ها" description="قابل استفاده در جدول و جزئیات">
          <div className="flex flex-wrap gap-2">
            {statusExamples.map((status) => (
              <Badge key={status.label} tone={status.tone} dot>
                {status.label}
              </Badge>
            ))}
          </div>
          <div className="mt-6 space-y-3">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
          <Button variant="danger" className="mt-6 w-full">
            نمونه عملیات حساس
          </Button>
        </Card>
      </div>
    </main>
  );
}
