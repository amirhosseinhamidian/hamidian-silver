import { PaymentRecoveryView } from '@/components/payments/payment-recovery-view';
import { Badge } from '@/components/ui/badge';
import { requireAdminSession } from '@/lib/auth/session';
import { loadPaymentRecovery } from '@/lib/payments/payment-recovery-data';
import { formatAdminInteger } from '@/lib/presentation/formatters';

export const dynamic = 'force-dynamic';

export default async function PaymentsPage() {
  const user = await requireAdminSession({ permissions: ['finance.read'], returnTo: '/payments' });
  const data = await loadPaymentRecovery();
  return (
    <main className="admin-container py-6 sm:py-8 lg:py-10">
      <header className="border-b border-[var(--admin-color-border)] pb-6">
        <Badge tone="info">مرحله {formatAdminInteger(22)}</Badge>
        <h1 className="mt-3 text-2xl font-black sm:text-3xl">بازیابی شروع پرداخت</h1>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--admin-color-muted)]">
          تلاش‌هایی را بررسی کنید که پاسخ شروع پرداخت آن‌ها نامشخص مانده است؛ بازیابی فقط با اطلاعات
          معتبر پنل درگاه و کنترل دوباره وضعیت سفارش انجام می‌شود.
        </p>
      </header>
      <PaymentRecoveryView {...data} canWrite={user.permissions.includes('finance.write')} />
    </main>
  );
}
