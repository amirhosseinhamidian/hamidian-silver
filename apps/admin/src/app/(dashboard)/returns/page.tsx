import { ReturnManagementView } from '@/components/returns/return-management-view';
import { Badge } from '@/components/ui/badge';
import { requireAdminSession } from '@/lib/auth/session';
import { formatAdminInteger } from '@/lib/presentation/formatters';
import { loadOrderReturns } from '@/lib/returns/returns-data';

export const dynamic = 'force-dynamic';

export default async function ReturnsPage() {
  const user = await requireAdminSession({ permissions: ['orders.read'], returnTo: '/returns' });
  const data = await loadOrderReturns();

  return (
    <main className="admin-container py-6 sm:py-8 lg:py-10">
      <header className="border-b border-[var(--admin-color-border)] pb-6">
        <Badge tone="info">مرحله {formatAdminInteger(27)}</Badge>
        <h1 className="mt-3 text-2xl font-black sm:text-3xl">مدیریت مرجوعی</h1>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--admin-color-muted)]">
          درخواست‌های مرجوعی و ظرفیت تخصیص‌یافته را بررسی کنید و هنگام دریافت هر قلم، مسیر بازگشت به
          موجودی یا تأمین‌کننده را به‌صورت قابل حسابرسی ثبت کنید.
        </p>
      </header>

      <div className="pt-6">
        <ReturnManagementView
          returns={data.returns}
          failed={data.failed}
          canReject={user.permissions.includes('orders.status.write')}
          canReceive={
            user.permissions.includes('orders.status.write') &&
            user.permissions.includes('inventory.write')
          }
        />
      </div>
    </main>
  );
}
