import { ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { requireAdminSession } from '@/lib/auth/session';
import { getAdminNavigation } from '@/lib/navigation/admin-navigation';

export default async function CustomerClubPage() {
  const user = await requireAdminSession({
    permissions: ['finance.read'],
    returnTo: '/customer-club',
  });
  const links = getAdminNavigation(user)
    .find(({ id }) => id === 'customer-club')
    ?.items.filter(({ href }) => href !== '/customer-club');

  return (
    <main className="admin-container space-y-5 py-6 sm:py-8 lg:py-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black sm:text-3xl">باشگاه مشتریان</h1>
        <ButtonLink href="/reward-policies/maintenance" variant="outline">
          گزارش تعهدات و تطبیق مالی
        </ButtonLink>
      </header>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {links?.map(({ id, label, href, description }) => (
          <Card key={id} title={label} description={description}>
            <ButtonLink href={href} variant="outline" size="sm" aria-label={`باز کردن ${label}`}>
              مشاهده
            </ButtonLink>
          </Card>
        ))}
      </div>
    </main>
  );
}
