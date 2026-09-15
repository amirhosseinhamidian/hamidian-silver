import { RefundManagementView } from '@/components/refunds/refund-management-view';
import { Badge } from '@/components/ui/badge';
import { requireAdminSession } from '@/lib/auth/session';
import { formatAdminInteger } from '@/lib/presentation/formatters';
import { loadRefundManagement } from '@/lib/refunds/refunds-data';

export const dynamic = 'force-dynamic';

export default async function RefundsPage() {
  const user = await requireAdminSession({
    permissions: ['finance.read'],
    returnTo: '/refunds',
  });
  const data = await loadRefundManagement();

  return (
    <main className="admin-container py-6 sm:py-8 lg:py-10">
      <header className="border-b border-[var(--admin-color-border)] pb-6">
        <Badge tone="info">مرحله {formatAdminInteger(21)}</Badge>
        <h1 className="mt-3 text-2xl font-black sm:text-3xl">مدیریت بازپرداخت</h1>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--admin-color-muted)]">
          درخواست مالی بازپرداخت را ثبت کنید، نتیجه عملیات درگاه را با مرجع معتبر تأیید کنید و سوابق
          کامل اپراتورها را مشاهده کنید.
        </p>
      </header>
      <RefundManagementView {...data} canWrite={user.permissions.includes('finance.write')} />
    </main>
  );
}
