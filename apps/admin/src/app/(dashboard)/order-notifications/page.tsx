import { redirect } from 'next/navigation';

import { OrderNotificationRecipientsView } from '@/components/order-notifications/order-notification-recipients-view';
import { Badge } from '@/components/ui/badge';
import { requireAdminSession } from '@/lib/auth/session';
import { loadOrderNotificationRecipients } from '@/lib/order-notifications/order-notification-recipients-data';

export const dynamic = 'force-dynamic';

export default async function OrderNotificationsPage() {
  const user = await requireAdminSession({
    permissions: ['settings.write'],
    returnTo: '/order-notifications',
  });
  if (!user.roles.includes('MANAGER')) redirect('/access-denied');
  const data = await loadOrderNotificationRecipients();

  return (
    <main className="admin-container py-6 sm:py-8 lg:py-10">
      <header className="border-b border-[var(--admin-color-border)] pb-6">
        <div className="flex flex-wrap gap-2">
          <Badge tone="info">اعلان سفارش</Badge>
          <Badge tone="danger">ویژه مدیر ارشد</Badge>
        </div>
        <h1 className="mt-3 text-2xl font-black sm:text-3xl">اتصال تلگرام و بله مدیران</h1>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--admin-color-muted)]">
          برای هر ادمین یا مدیر، Chat ID تلگرام و بله را ثبت کنید تا بعد از ثبت سفارش، خلاصه کامل
          سفارش و لینک مستقیم جزئیات در پنل مدیریت ارسال شود.
        </p>
      </header>
      <div className="pt-6">
        <OrderNotificationRecipientsView initialSnapshot={data.snapshot} failed={data.failed} />
      </div>
    </main>
  );
}
