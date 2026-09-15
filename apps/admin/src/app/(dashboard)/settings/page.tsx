import { SiteSettingsView } from '@/components/site-settings/site-settings-view';
import { Badge } from '@/components/ui/badge';
import { requireAdminSession } from '@/lib/auth/session';
import { formatAdminInteger } from '@/lib/presentation/formatters';
import { loadSiteSettingsData } from '@/lib/site-settings/site-settings-data';

export const dynamic = 'force-dynamic';

export default async function SiteSettingsPage() {
  const user = await requireAdminSession({ permissions: ['settings.read'], returnTo: '/settings' });
  const data = await loadSiteSettingsData();

  return (
    <main className="admin-container py-6 sm:py-8 lg:py-10">
      <header className="border-b border-[var(--admin-color-border)] pb-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="info">مرحله {formatAdminInteger(32)}</Badge>
          <Badge tone="neutral">تنظیمات نمایشی Storefront</Badge>
        </div>
        <h1 className="mt-3 text-2xl font-black sm:text-3xl">تنظیمات سایت</h1>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--admin-color-muted)]">
          Hero و انتخاب‌های صفحه اصلی، دسته‌های هدر، نوار اعلان، فوتر و اطلاعات تماس را مدیریت کنید.
        </p>
      </header>
      <div className="pt-6">
        <SiteSettingsView data={data} canWrite={user.permissions.includes('settings.write')} />
      </div>
    </main>
  );
}
