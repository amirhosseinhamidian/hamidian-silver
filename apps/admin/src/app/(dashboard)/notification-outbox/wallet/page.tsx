import { cookies } from 'next/headers';
import {
  WalletNotificationSettingsForm,
  type WalletNotificationSettings,
} from '@/components/notification-outbox/wallet-notification-settings';
import { Alert } from '@/components/ui/alert';
import { ButtonLink } from '@/components/ui/button';
import { requireAdminSession } from '@/lib/auth/session';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { readJsonResponse, requestAdminCatalog } from '@/lib/catalog/catalog-api';

export const dynamic = 'force-dynamic';
const path = '/notification-outbox/wallet';

async function loadSettings(): Promise<WalletNotificationSettings | null> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const response = await requestAdminCatalog('/api/v1/notifications/wallet/settings', token);
    return response.ok ? ((await readJsonResponse(response)) as WalletNotificationSettings) : null;
  } catch {
    return null;
  }
}

export default async function WalletNotificationSettingsPage() {
  const user = await requireAdminSession({ permissions: ['orders.read'], returnTo: path });
  const settings = await loadSettings();
  return (
    <main className="admin-container space-y-6 py-6 sm:py-8 lg:py-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black sm:text-3xl">اعلان‌های کیف پول</h1>
        <ButtonLink href="/notification-outbox" variant="outline" size="sm">
          تاریخچه و بازیابی ارسال
        </ButtonLink>
      </header>
      {settings ? (
        <WalletNotificationSettingsForm
          initial={settings}
          canWrite={user.permissions.includes('orders.status.write')}
        />
      ) : (
        <Alert tone="danger" action={<ButtonLink href={path}>تلاش دوباره</ButtonLink>}>
          دریافت تنظیمات اعلان انجام نشد.
        </Alert>
      )}
    </main>
  );
}
