import { AuditLogView } from '@/components/audit-log/audit-log-view';
import { Badge } from '@/components/ui/badge';
import { requireAdminSession } from '@/lib/auth/session';
import { loadAuditLog } from '@/lib/audit-log/audit-log-data';
import { formatAdminInteger } from '@/lib/presentation/formatters';

export const dynamic = 'force-dynamic';

export default async function AuditLogPage() {
  await requireAdminSession({ permissions: ['audit.read'], returnTo: '/audit' });
  const data = await loadAuditLog();

  return (
    <main className="admin-container py-6 sm:py-8 lg:py-10">
      <header className="border-b border-[var(--admin-color-border)] pb-6">
        <div className="flex flex-wrap gap-2">
          <Badge tone="info">مرحله {formatAdminInteger(37)}</Badge>
          <Badge tone="neutral">تاریخچه تغییرناپذیر</Badge>
        </div>
        <h1 className="mt-3 text-2xl font-black sm:text-3xl">گزارش فعالیت‌های حساس</h1>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--admin-color-muted)]">
          شرح فارسی عملیات مدیران، تغییرات مهم قبل و بعد، نتیجه واقعی و جزئیات فنی درخواست را بررسی
          کنید. داده‌های حساس و محتوای کامل درخواست یا پاسخ نگهداری نمی‌شوند.
        </p>
      </header>
      <div className="pt-6">
        <AuditLogView {...data} />
      </div>
    </main>
  );
}
