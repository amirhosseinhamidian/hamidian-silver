import { AccountDashboard } from '@/components/account/account-dashboard';
import { ButtonLink } from '@/components/ui/button';
import { referralPath } from '@/lib/referrals/presentation';

export default function AccountPage() {
  return (
    <main id="main-content" className="sf-container pb-[var(--sf-section-space)] pt-8 sm:pt-10">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--sf-color-border)] pb-7">
        <div>
          <p className="text-sm text-[var(--sf-color-muted)]">حساب کاربری</p>
          <h1 className="mt-2 text-4xl font-normal sm:text-5xl">حساب من</h1>
        </div>
        <ButtonLink href={referralPath} variant="outline">
          معرفی دوستان
        </ButtonLink>
      </header>
      <AccountDashboard />
    </main>
  );
}
