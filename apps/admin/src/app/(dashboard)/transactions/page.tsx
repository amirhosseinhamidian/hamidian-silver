import { PaymentTransactionsView } from '@/components/transactions/payment-transactions-view';
import { Badge } from '@/components/ui/badge';
import { requireAdminSession } from '@/lib/auth/session';
import { formatAdminInteger } from '@/lib/presentation/formatters';
import { loadPaymentTransactions } from '@/lib/transactions/payment-transactions-data';

export const dynamic = 'force-dynamic';

export default async function TransactionsPage() {
  await requireAdminSession({ permissions: ['finance.read'], returnTo: '/transactions' });
  const data = await loadPaymentTransactions();

  return (
    <main className="admin-container py-6 sm:py-8 lg:py-10">
      <header className="border-b border-[var(--admin-color-border)] pb-6">
        <Badge tone="info">مرحله {formatAdminInteger(19)}</Badge>
        <h1 className="mt-3 text-2xl font-black sm:text-3xl">مدیریت تراکنش‌ها</h1>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--admin-color-muted)]">
          همه تلاش‌های پرداخت، نتیجه verification، خطاهای درگاه و ارتباط هر تراکنش با سفارش و مشتری
          را بررسی کنید.
        </p>
      </header>

      <PaymentTransactionsView initialPage={data.data} failed={data.failed} />
    </main>
  );
}
