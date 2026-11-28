import type { components } from '@hamidian/contracts';
import { cookies } from 'next/headers';
import { RewardActivationTimingForm } from '@/components/reward-policies/reward-activation-timing-form';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { requireAdminSession } from '@/lib/auth/session';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { readJsonResponse, requestAdminCatalog } from '@/lib/catalog/catalog-api';
import {
  formatAdminDateTime,
  formatAdminInteger,
  formatAdminToman,
} from '@/lib/presentation/formatters';
import { parseRewardActivationTiming } from '@/lib/reward-policies/activation-timing';
import { purchaseRanks } from '@/lib/reward-policies/referral-reward-policy';

export const dynamic = 'force-dynamic';

async function loadPolicy<T>(token: string | undefined, path: string): Promise<T | null> {
  if (!token) return null;
  try {
    const response = await requestAdminCatalog(`/api/v1/reward-policies/${path}`, token);
    return response.ok ? ((await readJsonResponse(response)) as T) : null;
  } catch {
    return null;
  }
}

const rate = new Intl.NumberFormat('fa-IR', { style: 'percent', maximumFractionDigits: 2 });

export default async function RewardPoliciesPage() {
  const user = await requireAdminSession({
    permissions: ['finance.read'],
    returnTo: '/reward-policies',
  });
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const [state, rawTiming] = await Promise.all([
    loadPolicy<components['schemas']['ActiveRewardPolicyDto']>(token, 'active'),
    loadPolicy<unknown>(token, 'activation-timing'),
  ]);
  const timing = parseRewardActivationTiming(rawTiming);
  const policy = state?.policy;

  return (
    <main className="admin-container space-y-6 py-6 sm:py-8 lg:py-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black sm:text-3xl">پاداش خرید</h1>
        <nav aria-label="عملیات پاداش و کیف پول" className="flex flex-wrap gap-2">
          <ButtonLink href="/reward-policies/simulator" variant="outline" size="sm">
            شبیه‌ساز سیاست‌ها
          </ButtonLink>
          <ButtonLink href="/reward-policies/history" variant="outline" size="sm">
            تاریخچهٔ تنظیمات
          </ButtonLink>
        </nav>
      </header>
      <Card title="سیاست مؤثر پاداش خرید">
        {!state ? (
          <Alert tone="danger">دریافت نسخهٔ مؤثر انجام نشد.</Alert>
        ) : !policy ? (
          <p className="text-sm">هنوز نسخهٔ مؤثری برای پاداش خرید منتشر نشده است.</p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <Badge tone={policy.enabled ? 'success' : 'neutral'}>
                {policy.enabled ? 'فعال' : 'غیرفعال'}
              </Badge>
              <span>نسخهٔ {formatAdminInteger(policy.version)}</span>
              {policy.effectiveAt && <span>از {formatAdminDateTime(policy.effectiveAt)}</span>}
            </div>
            {policy.definition.grantRules.length ? (
              <ul className="divide-y divide-[var(--admin-color-border)] text-sm">
                {policy.definition.grantRules.map((rule) => (
                  <li key={rule.code} className="flex flex-wrap items-center gap-2 py-2">
                    <span>
                      {purchaseRanks.find(({ value }) => value === rule.purchaseRank)?.label}
                    </span>
                    <strong>
                      {rule.method === 'PERCENT'
                        ? rate.format(rule.value / 10_000)
                        : formatAdminToman(rule.value)}
                    </strong>
                    <span>از {formatAdminToman(rule.minimumToman)}</span>
                    {rule.maximumExclusiveToman != null && (
                      <span>تا کمتر از {formatAdminToman(rule.maximumExclusiveToman)}</span>
                    )}
                    <span>سقف {formatAdminToman(rule.capToman)}</span>
                    {!rule.enabled && <Badge tone="neutral">قانون غیرفعال</Badge>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm">قانون کسب پاداش در این نسخه ثبت نشده است.</p>
            )}
            <p className="text-sm">
              بودجهٔ ماهانهٔ پاداش {formatAdminToman(policy.definition.budget.rewardPerPeriodToman)}
            </p>
          </div>
        )}
      </Card>
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
