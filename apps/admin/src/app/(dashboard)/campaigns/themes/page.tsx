import { FestivalThemeLibrary } from '@/components/campaigns/festival-theme-library';
import { ButtonLink } from '@/components/ui/button';
import { requireAdminSession } from '@/lib/auth/session';

export default async function FestivalThemesPage() {
  const user = await requireAdminSession({
    permissions: ['settings.read'],
    returnTo: '/campaigns/themes',
  });
  return (
    <main className="admin-container space-y-5 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">کتابخانهٔ تم جشنواره‌ها</h1>
        <ButtonLink href="/campaigns?view=festivals" variant="outline">
          جشنواره‌های فروش
        </ButtonLink>
      </header>
      <FestivalThemeLibrary canWrite={user.permissions.includes('settings.write')} />
    </main>
  );
}
