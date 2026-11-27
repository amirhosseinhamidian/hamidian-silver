import { cookies } from 'next/headers';
import { PolicySimulator } from '@/components/reward-policies/policy-simulator';
import { Alert } from '@/components/ui/alert';
import { ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { requireAdminSession } from '@/lib/auth/session';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { readJsonResponse, requestAdminCatalog } from '@/lib/catalog/catalog-api';
import { formatAdminDateTime, formatAdminInteger } from '@/lib/presentation/formatters';
import { parseRewardActivationTiming } from '@/lib/reward-policies/activation-timing';
import {
  asObject,
  policyDecisions,
  type PolicyReviewList,
} from '@/lib/reward-policies/policy-simulator';

const route = '/reward-policies/simulator';
export const dynamic = 'force-dynamic';

async function loadResource(path: string, token?: string) {
  if (!token) return null;
  try {
    const response = await requestAdminCatalog('/api/v1/reward-policies' + path, token);
    return response.ok ? await readJsonResponse(response) : null;
  } catch {
    return null;
  }
}

export default async function PolicySimulatorPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const user = await requireAdminSession({ permissions: ['finance.read'], returnTo: route });
  const rawPage = (await searchParams).page;
  const parsed = Number(Array.isArray(rawPage) ? rawPage[0] : rawPage);
  const page = Number.isInteger(parsed) && parsed >= 1 && parsed <= 10000 ? parsed : 1;
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const [active, recentPolicies, history] = await Promise.all([
    loadResource('/activation-timing', token),
    loadResource('?page=1', token),
    loadResource('/policy-simulator/reviews?page=' + page, token),
  ]);
  const timing = parseRewardActivationTiming(active);
  const policyItems = asObject(recentPolicies)?.items;
  const versions = Array.isArray(policyItems)
    ? policyItems.flatMap((entry) => {
        const version = asObject(entry)?.version;
        return typeof version === 'number' && Number.isInteger(version) ? [version] : [];
      })
    : [];
  const historyObject = asObject(history);
  const reviews =
    historyObject && Array.isArray(historyObject.items)
      ? (historyObject as unknown as PolicyReviewList)
      : null;

  return (
    <main className="admin-container space-y-5 py-6 sm:py-8 lg:py-10">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">شبیه‌ساز سیاست‌های فروش و اعتبار</h1>
          <p className="mt-2 text-sm text-[var(--admin-color-muted)]">
            سناریوی نمونه، قیمت و نتیجهٔ سیاست‌ها را بدون ثبت سفارش یا تغییر اعتبار بررسی می‌کند.
          </p>
        </div>
        <ButtonLink href="/reward-policies" variant="outline" size="sm">
          بازگشت به پاداش خرید
        </ButtonLink>
      </header>
      <PolicySimulator
        activeVersion={timing?.policyVersion ?? null}
        versions={versions}
        canWrite={user.permissions.includes('finance.write')}
      />
      <Card title="بررسی‌های ثبت‌شده">
        {!reviews ? (
          <Alert tone="danger">دریافت بررسی‌های ثبت‌شده انجام نشد.</Alert>
        ) : reviews.items.length === 0 ? (
          <p className="text-sm text-[var(--admin-color-muted)]">
            بررسی ثبت‌شده‌ای در این صفحه وجود ندارد.
          </p>
        ) : (
          <ul className="space-y-3">
            {reviews.items.map((item) => (
              <li key={item.id}>
                <details className="rounded-lg border border-[var(--admin-color-border)] p-3">
                  <summary className="cursor-pointer text-sm font-semibold">
                    {item.mode === 'BASKET' ? 'سبد نمونه' : 'مرور تاریخی'}،{' '}
                    {policyDecisions[item.decision]}، {formatAdminDateTime(item.createdAt)}
                  </summary>
                  <p className="mt-2 text-xs">
                    شناسهٔ بررسی <bdi className="break-all">{item.id}</bdi>
                  </p>
                  <div className="mt-2 grid min-w-0 gap-3 lg:grid-cols-2">
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold">ورودی ثبت‌شده</h3>
                      <pre
                        dir="ltr"
                        tabIndex={0}
                        className="max-h-80 overflow-auto whitespace-pre-wrap break-all p-2 text-xs"
                      >
                        {JSON.stringify(item.input, null, 2)}
                      </pre>
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold">نتیجهٔ ثبت‌شده</h3>
                      <pre
                        dir="ltr"
                        tabIndex={0}
                        className="max-h-80 overflow-auto whitespace-pre-wrap break-all p-2 text-xs"
                      >
                        {JSON.stringify(item.result, null, 2)}
                      </pre>
                    </div>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
        {reviews && (page > 1 || reviews.hasMore) && (
          <nav aria-label="صفحه‌بندی بررسی‌ها" className="mt-3 flex flex-wrap items-center gap-2">
            {page > 1 && (
              <ButtonLink href={`${route}?page=${page - 1}`} size="sm" variant="outline">
                صفحهٔ قبل
              </ButtonLink>
            )}
            <span className="text-sm">صفحهٔ {formatAdminInteger(page)}</span>
            {reviews.hasMore && page < 10000 && (
              <ButtonLink href={`${route}?page=${page + 1}`} size="sm" variant="outline">
                صفحهٔ بعد
              </ButtonLink>
            )}
          </nav>
        )}
      </Card>
    </main>
  );
}
