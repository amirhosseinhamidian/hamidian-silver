import { SupplierCreditsView } from '@/components/supplier-credits/supplier-credits-view';
import { Badge } from '@/components/ui/badge';
import { requireAdminSession } from '@/lib/auth/session';
import { formatAdminInteger } from '@/lib/presentation/formatters';
import { loadSupplierCredits } from '@/lib/supplier-credits/supplier-credits-data';

export const dynamic = 'force-dynamic';

export default async function SupplierCreditsPage() {
  await requireAdminSession({
    permissions: ['finance.read'],
    returnTo: '/supplier-credits',
  });
  const data = await loadSupplierCredits();

  return (
    <main className="admin-container py-6 sm:py-8 lg:py-10">
      <header className="border-b border-[var(--admin-color-border)] pb-6">
        <Badge tone="info">مرحله {formatAdminInteger(28)}</Badge>
        <h1 className="mt-3 text-2xl font-black sm:text-3xl">اعتبار تأمین‌کنندگان</h1>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--admin-color-muted)]">
          اعتبارهای ایجادشده از اقلام مرجوعیِ بازگشتی به تأمین‌کننده را همراه با منبع، مانده و سابقه
          مصرف آن‌ها بررسی کنید.
        </p>
      </header>

      <div className="pt-6">
        <SupplierCreditsView credits={data.credits} failed={data.failed} />
      </div>
    </main>
  );
}
