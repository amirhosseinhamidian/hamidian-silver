import { PaymentOperationsView } from '@/components/payments/payment-operations-view';
import { Badge } from '@/components/ui/badge';
import { requireAdminSession } from '@/lib/auth/session';
import { loadPaymentOperations } from '@/lib/payments/payment-operations-data';
import { formatAdminInteger } from '@/lib/presentation/formatters';

export const dynamic = 'force-dynamic';

export default async function PaymentsPage() {
  const user = await requireAdminSession({ permissions: ['finance.read'], returnTo: '/payments' });
  const data = await loadPaymentOperations();
  return (
    <main className="admin-container py-6 sm:py-8 lg:py-10">
      <header className="border-b border-[var(--admin-color-border)] pb-6">
        <Badge tone="info">مرحله {formatAdminInteger(17)}</Badge>
        <h1 className="mt-3 text-2xl font-black sm:text-3xl">عملیات پرداخت و مغایرت‌گیری</h1>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--admin-color-muted)]">
          تلاش‌های پرداخت نامشخص و مغایرت‌های درگاه را بررسی کنید؛ هر اقدام مالی با مرجع و یادداشت
          اپراتور ثبت می‌شود.
        </p>
      </header>
      <div className="pt-6">
        <PaymentOperationsView {...data} canWrite={user.permissions.includes('finance.write')} />
      </div>
    </main>
  );
}
