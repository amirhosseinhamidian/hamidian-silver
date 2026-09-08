import { PaymentReconciliationView } from '@/components/payments/payment-reconciliation-view';
import { Badge } from '@/components/ui/badge';
import { requireAdminSession } from '@/lib/auth/session';
import { loadPaymentReconciliations } from '@/lib/payments/payment-reconciliation-data';
import { formatAdminInteger } from '@/lib/presentation/formatters';

export const dynamic = 'force-dynamic';

export default async function ReconciliationsPage() {
  const user = await requireAdminSession({
    permissions: ['finance.read'],
    returnTo: '/reconciliations',
  });
  const data = await loadPaymentReconciliations();

  return (
    <main className="admin-container py-6 sm:py-8 lg:py-10">
      <header className="border-b border-[var(--admin-color-border)] pb-6">
        <Badge tone="info">مرحله {formatAdminInteger(20)}</Badge>
        <h1 className="mt-3 text-2xl font-black sm:text-3xl">تطبیق و رفع مغایرت پرداخت</h1>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--admin-color-muted)]">
          پرداخت‌های مغایر را با پنل درگاه تطبیق دهید، شواهد تصمیم را ثبت کنید و سابقه کامل موارد
          رفع‌شده را مشاهده کنید.
        </p>
      </header>
      <PaymentReconciliationView {...data} canWrite={user.permissions.includes('finance.write')} />
    </main>
  );
}
