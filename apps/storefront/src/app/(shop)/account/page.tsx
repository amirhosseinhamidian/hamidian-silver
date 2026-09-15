import { AccountDashboard } from '@/components/account/account-dashboard';

export default function AccountPage() {
  return (
    <main id="main-content" className="sf-container pb-[var(--sf-section-space)] pt-8 sm:pt-10">
      <header className="border-b border-[var(--sf-color-border)] pb-7">
        <p className="text-sm text-[var(--sf-color-muted)]">حساب کاربری</p>
        <h1 className="mt-2 text-4xl font-normal sm:text-5xl">حساب من</h1>
      </header>
      <AccountDashboard />
    </main>
  );
}
