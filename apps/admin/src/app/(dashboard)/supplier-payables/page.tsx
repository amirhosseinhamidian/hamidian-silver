import { SupplierPayablesView } from '@/components/supplier-payables/supplier-payables-view';
import { Badge } from '@/components/ui/badge';
import { requireAdminSession } from '@/lib/auth/session';
import { formatAdminInteger } from '@/lib/presentation/formatters';
import { loadSupplierPayables } from '@/lib/supplier-payables/supplier-payables-data';

export const dynamic = 'force-dynamic';

export default async function SupplierPayablesPage() {
  await requireAdminSession({
    permissions: ['finance.read'],
    returnTo: '/supplier-payables',
  });
  const data = await loadSupplierPayables();

  return (
    <main className="admin-container py-6 sm:py-8 lg:py-10">
      <header className="border-b border-[var(--admin-color-border)] pb-6">
        <Badge tone="info">مرحله {formatAdminInteger(29)}</Badge>
        <h1 className="mt-3 text-2xl font-black sm:text-3xl">بدهی تأمین‌کنندگان</h1>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--admin-color-muted)]">
          بدهی‌های ایجادشده از سفارش‌های پرداخت‌شده را براساس تأمین‌کننده، دوره و وضعیت تسویه بررسی
          کنید و موارد آماده ورود به batch تسویه را سریع تشخیص دهید.
        </p>
      </header>

      <div className="pt-6">
        <SupplierPayablesView
          payables={data.payables}
          summary={data.summary}
          failed={data.failed}
        />
      </div>
    </main>
  );
}
