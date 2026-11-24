import { ReferralsPanel } from '@/components/account/referrals-panel';
import { ButtonLink } from '@/components/ui/button';

export default function ReferralsPage() {
  return (
    <main id="main-content" className="sf-container pb-[var(--sf-section-space)] pt-8 sm:pt-10">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--sf-color-border)] pb-7">
        <h1 className="text-4xl font-normal sm:text-5xl">معرفی دوستان</h1>
        <ButtonLink href="/account" variant="outline">
          حساب من
        </ButtonLink>
      </header>
      <ReferralsPanel />
    </main>
  );
}
