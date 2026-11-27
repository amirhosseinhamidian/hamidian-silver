import { cookies } from 'next/headers';
import { RewardActivationTimingForm } from '@/components/reward-policies/reward-activation-timing-form';
import { Alert } from '@/components/ui/alert';
import { ButtonLink } from '@/components/ui/button';
import { requireAdminSession } from '@/lib/auth/session';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { readJsonResponse, requestAdminCatalog } from '@/lib/catalog/catalog-api';
import { parseRewardActivationTiming } from '@/lib/reward-policies/activation-timing';

export const dynamic = 'force-dynamic';

async function loadActivationTiming() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const response = await requestAdminCatalog('/api/v1/reward-policies/activation-timing', token);
    return response.ok ? parseRewardActivationTiming(await readJsonResponse(response)) : null;
  } catch {
    return null;
  }
}

export default async function RewardPoliciesPage() {
  const user = await requireAdminSession({
    permissions: ['finance.read'],
    returnTo: '/reward-policies',
  });
  const timing = await loadActivationTiming();

  return (
    <main className="admin-container space-y-6 py-6 sm:py-8 lg:py-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black sm:text-3xl">پاداش خرید</h1>
        <nav aria-label="عملیات پاداش و کیف پول" className="flex flex-wrap gap-2">
          <ButtonLink href="/reward-policies/rollout" variant="outline" size="sm">
            وضعیت انتشار و صدور
          </ButtonLink>
          <ButtonLink href="/reward-policies/simulator" variant="outline" size="sm">
            شبیه‌ساز سیاست‌ها
          </ButtonLink>
          <ButtonLink href="/reward-policies/referrals" variant="outline" size="sm">
            سیاست پاداش معرفی
          </ButtonLink>
          <ButtonLink href="/reward-policies/wallet-operations" variant="outline" size="sm">
            مدیریت کیف پول مشتری
          </ButtonLink>
          <ButtonLink href="/reward-policies/history" variant="outline" size="sm">
            تاریخچهٔ تنظیمات
          </ButtonLink>
          <ButtonLink href="/reward-policies/maintenance" variant="outline" size="sm">
            گزارش تعهدات و تطبیق کیف پول
          </ButtonLink>
        </nav>
      </header>
      {timing ? (
        <RewardActivationTimingForm
          initialTiming={timing}
          canWrite={user.permissions.includes('finance.write')}
        />
      ) : (
        <Alert
          tone="danger"
          action={
            <ButtonLink href="/reward-policies" variant="outline">
              تلاش دوباره
            </ButtonLink>
          }
        >
          دریافت تنظیمات پاداش خرید انجام نشد.
        </Alert>
      )}
    </main>
  );
}
