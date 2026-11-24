import { cookies } from 'next/headers';
import { ReferralEditor, ReferralPublish } from '@/components/referral-policies/referral-editor';
import { ReferralScopeLookup } from '@/components/referral-policies/referral-scope-lookup';
import { Alert } from '@/components/ui/alert';
import { ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { requireAdminSession } from '@/lib/auth/session';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { readJsonResponse, requestAdminCatalog } from '@/lib/catalog/catalog-api';
import { formatAdminDateTime, formatAdminInteger } from '@/lib/presentation/formatters';
import {
  referralPolicyPath,
  type ReferralVersionDetail,
  type ReferralVersionList,
} from '@/lib/reward-policies/referral-reward-policy';

export const dynamic = 'force-dynamic';

export default async function ReferralRewardPoliciesPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ page?: string; version?: string }>;
}>) {
  const user = await requireAdminSession({
    permissions: ['finance.read'],
    returnTo: referralPolicyPath,
  });
  const canWrite = user.permissions.includes('finance.write');
  const query = await searchParams;
  const number = Number(query.page);
  const page = Number.isInteger(number) && number >= 1 && number <= 10_000 ? number : 1;
  const version = Number(query.version);
  const hasVersion = Number.isInteger(version) && version > 0 && version <= 2_147_483_647;
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  async function read<T>(suffix: string): Promise<T | null> {
    if (!token) return null;
    try {
      const result = await requestAdminCatalog(`/api/v1/referral-reward-policies${suffix}`, token);
      return result.ok ? ((await readJsonResponse(result)) as T) : null;
    } catch {
      return null;
    }
  }
  const [history, detail] = await Promise.all([
    read<ReferralVersionList>(`?page=${page}`),
    hasVersion ? read<ReferralVersionDetail>(`/${version}`) : null,
  ]);
  const selected = hasVersion ? detail : (history?.active ?? null);
  const active = history?.active;
  const urlFor = (next: number, selectedVersion?: number) =>
    `${referralPolicyPath}?page=${next}${selectedVersion ? `&version=${selectedVersion}` : ''}`;
  return (
    <main className="admin-container space-y-6 py-6 sm:py-8 lg:py-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black sm:text-3xl">سیاست پاداش معرفی</h1>
        <ButtonLink href="/reward-policies" size="sm" variant="outline">
          پاداش خرید
        </ButtonLink>
      </header>
      {!history ? (
        <Alert
          tone="danger"
          action={
            <ButtonLink href={urlFor(page, hasVersion ? version : undefined)}>
              تلاش دوباره
            </ButtonLink>
          }
        >
          دریافت سیاست‌ها انجام نشد.
        </Alert>
      ) : (
        <>
          <Card title="نسخهٔ مؤثر">
            {active ? (
              <p className="text-sm">
                نسخهٔ {formatAdminInteger(active.version)} · {active.enabled ? 'فعال' : 'غیرفعال'} ·{' '}
                {active.effectiveAt && formatAdminDateTime(active.effectiveAt)}
              </p>
            ) : (
              <p className="text-sm">هنوز نسخهٔ مؤثری منتشر نشده است.</p>
            )}
          </Card>
          <Card title="تاریخچهٔ پیش‌نویس و انتشار">
            {history.items.length ? (
              <ul className="divide-y divide-[var(--admin-color-border)]">
                {history.items.map((row) => (
                  <li
                    key={row.version}
                    className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
                  >
                    <div className="min-w-0 space-y-1">
                      <p>
                        نسخهٔ {formatAdminInteger(row.version)} ·{' '}
                        {row.publishedAt ? 'منتشرشده' : 'پیش‌نویس'} ·{' '}
                        {formatAdminDateTime(row.publishedAt ?? row.createdAt)}
                        {row.effectiveAt &&
                          ` · اثرگذاری از ${formatAdminDateTime(row.effectiveAt)}`}
                      </p>
                      {row.publishedById && (
                        <p className="break-all text-xs">
                          منتشرکننده <bdi>{row.publishedById}</bdi>
                        </p>
                      )}
                    </div>
                    <ButtonLink
                      href={urlFor(page, row.version)}
                      size="sm"
                      variant="outline"
                      aria-current={selected?.version === row.version ? 'page' : undefined}
                    >
                      مشاهدهٔ نسخهٔ {formatAdminInteger(row.version)}
                    </ButtonLink>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm">در این صفحه نسخه‌ای ثبت نشده است.</p>
            )}
            {(page > 1 || history.hasMore) && (
              <nav
                aria-label="صفحه‌بندی نسخه‌ها"
                className="mt-4 flex flex-wrap items-center gap-3"
              >
                {page > 1 && (
                  <ButtonLink
                    href={urlFor(page - 1, selected?.version)}
                    size="sm"
                    variant="outline"
                  >
                    صفحهٔ قبل
                  </ButtonLink>
                )}
                <span className="text-sm">صفحهٔ {formatAdminInteger(page)}</span>
                {history.hasMore && page < 10_000 && (
                  <ButtonLink
                    href={urlFor(page + 1, selected?.version)}
                    size="sm"
                    variant="outline"
                  >
                    صفحهٔ بعد
                  </ButtonLink>
                )}
              </nav>
            )}
          </Card>
          {hasVersion && !detail ? (
            <Alert tone="danger">دریافت نسخهٔ انتخابی انجام نشد.</Alert>
          ) : (
            <>
              {canWrite && selected && !selected.publishedAt && (
                <ReferralPublish key={selected.version} draft={selected} />
              )}
              <ReferralScopeLookup />
              <ReferralEditor
                key={selected?.version ?? 'new'}
                selected={selected}
                canWrite={canWrite}
                historyPage={page}
              />
            </>
          )}
        </>
      )}
    </main>
  );
}
