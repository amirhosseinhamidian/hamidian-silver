import { NotificationOutboxView } from '@/components/notification-outbox/notification-outbox-view';
import { Badge } from '@/components/ui/badge';
import { requireAdminSession } from '@/lib/auth/session';
import { loadNotificationOutbox } from '@/lib/notification-outbox/notification-outbox-data';
import { formatAdminInteger } from '@/lib/presentation/formatters';

export const dynamic = 'force-dynamic';
export default async function NotificationOutboxPage() {
  const user = await requireAdminSession({
    permissions: ['orders.read'],
    returnTo: '/notification-outbox',
  });
  const data = await loadNotificationOutbox();
  return (
    <main className="admin-container py-6 sm:py-8 lg:py-10">
      <header className="border-b border-[var(--admin-color-border)] pb-6">
        <div className="flex flex-wrap gap-2">
          <Badge tone="info">مرحله {formatAdminInteger(36)}</Badge>
          <Badge tone="neutral">ارسال قابل بازیابی</Badge>
        </div>
        <h1 className="mt-3 text-2xl font-black sm:text-3xl">Notification Outbox</h1>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--admin-color-muted)]">
          سلامت صف پیام‌های مشتری و هشدارهای عملیاتی را پایش کنید و خطاهای قطعی یا نتیجه‌های نامشخص
          را ایمن تعیین تکلیف کنید.
        </p>
      </header>
      <div className="pt-6">
        <NotificationOutboxView
          {...data}
          canRecover={user.permissions.includes('orders.status.write')}
        />
      </div>
    </main>
  );
}
