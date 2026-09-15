import { SupplierSettlementsView } from '@/components/supplier-settlements/supplier-settlements-view';
import { Badge } from '@/components/ui/badge';
import { requireAdminSession } from '@/lib/auth/session';
import { formatAdminInteger } from '@/lib/presentation/formatters';
import { loadSupplierSettlements } from '@/lib/supplier-settlements/supplier-settlements-data';

export const dynamic = 'force-dynamic';

export default async function SupplierSettlementsPage() {
  const user = await requireAdminSession({
    permissions: ['finance.read'],
    returnTo: '/supplier-settlements',
  });
  const data = await loadSupplierSettlements();

  return (
    <main className="admin-container py-6 sm:py-8 lg:py-10">
      <header className="border-b border-[var(--admin-color-border)] pb-6">
        <Badge tone="info">مرحله {formatAdminInteger(30)}</Badge>
        <h1 className="mt-3 text-2xl font-black sm:text-3xl">دوره‌های تسویه تأمین‌کنندگان</h1>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--admin-color-muted)]">
          بدهی‌های یک تأمین‌کننده را در batch امن تجمیع کنید، اعتبارهای مرجوعی را کسر کنید و پرداخت
          نهایی یا لغو دوره را با سابقه قابل حسابرسی ثبت کنید.
        </p>
      </header>

      <div className="pt-6">
        <SupplierSettlementsView
          settlements={data.settlements}
          payables={data.payables}
          credits={data.credits}
          failed={data.failed}
          canWrite={user.permissions.includes('finance.write')}
        />
      </div>
    </main>
  );
}
