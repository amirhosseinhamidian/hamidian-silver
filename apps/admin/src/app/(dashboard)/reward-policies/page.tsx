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
      <h1 className="text-2xl font-black sm:text-3xl">پاداش خرید</h1>
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
