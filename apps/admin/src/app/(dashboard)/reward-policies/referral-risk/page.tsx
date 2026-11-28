import { cookies } from 'next/headers';
import { ReferralRiskPolicyForm } from '@/components/referral-policies/referral-risk-policy-form';
import { ReferralRiskReviewForm } from '@/components/referral-policies/referral-risk-review-form';
import { Alert } from '@/components/ui/alert';
import { ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { requireAdminSession } from '@/lib/auth/session';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { readJsonResponse, requestAdminCatalog } from '@/lib/catalog/catalog-api';
import { formatAdminDateTime, formatAdminInteger } from '@/lib/presentation/formatters';
import {
  actionLabels,
  caseUuid,
  confidenceLabels,
  referralRiskPath,
  riskLabels,
  type RiskCase,
  type RiskPolicyOverview,
  type RiskQueue,
} from '@/lib/reward-policies/referral-risk';

export const dynamic = 'force-dynamic';
const queues = { open: 'در انتظار بررسی', resolved: 'تعیین‌تکلیف‌شده', all: 'همه' } as const;

type Query = { view?: string; page?: string; queue?: string; case?: string; version?: string };

export default async function ReferralRiskPage({
  searchParams,
}: Readonly<{ searchParams: Promise<Query> }>) {
  const user = await requireAdminSession({
    permissions: ['finance.read'],
    returnTo: referralRiskPath,
  });
  const canWrite = user.permissions.includes('finance.write');
  const query = await searchParams;
  const view = query.view === 'policy' ? 'policy' : 'cases';
  const pageNumber = Number(query.page);
  const page =
    Number.isInteger(pageNumber) && pageNumber >= 1 && pageNumber <= 10_000 ? pageNumber : 1;
  const queue = query.queue === 'resolved' || query.queue === 'all' ? query.queue : 'open';
  const id = typeof query.case === 'string' && caseUuid.test(query.case) ? query.case : null;
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;

  async function read<T>(path: string): Promise<T | null> {
    if (!token) return null;
    try {
      const response = await requestAdminCatalog(`/api/v1/referral-risk/${path}`, token);
      return response.ok ? ((await readJsonResponse(response)) as T) : null;
    } catch {
      return null;
    }
  }

  const [policies, cases, detail] = await Promise.all([
    view === 'policy' ? read<RiskPolicyOverview>(`policies?page=${page}`) : null,
    read<RiskQueue>(
      view === 'cases' ? `cases?page=${page}&queue=${queue}` : 'cases?page=1&queue=all',
    ),
    id ? read<RiskCase>(`cases/${id}`) : null,
  ]);
  const policyCases = [...(detail ? [detail] : []), ...(cases?.items ?? [])];
  const policyCaseOptions = [
    ...new Map(policyCases.map((row) => [row.attributionId, row])).values(),
  ].map((row, index) => ({
    value: row.attributionId,
    label: `پروندهٔ ${formatAdminInteger(index + 1)} · ${formatAdminDateTime(row.assessedAt)} · ${actionLabels[row.action]}`,
  }));
  const policy =
    policies?.history.find((row) => String(row.version) === query.version) ?? policies?.active;
  const hasMore = view === 'policy' ? policies?.hasMore : cases?.hasMore;
  const href = (next: number) => `${referralRiskPath}?view=${view}&queue=${queue}&page=${next}`;
  return (
    <main className="admin-container space-y-6 py-6 sm:py-8 lg:py-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black sm:text-3xl">بررسی ریسک معرفی</h1>
        <ButtonLink href="/reward-policies/referrals" size="sm" variant="outline">
          سیاست پاداش معرفی
        </ButtonLink>
      </header>
      <nav aria-label="بخش‌های بررسی ریسک" className="flex flex-wrap gap-2">
        <ButtonLink
          href={referralRiskPath}
          aria-current={view === 'cases' ? 'page' : undefined}
          variant={view === 'cases' ? 'primary' : 'outline'}
        >
          صف پرونده‌ها
        </ButtonLink>
        <ButtonLink
          href={`${referralRiskPath}?view=policy`}
          aria-current={view === 'policy' ? 'page' : undefined}
          variant={view === 'policy' ? 'primary' : 'outline'}
        >
          تنظیم سیگنال‌ها
        </ButtonLink>
      </nav>
      {view === 'policy' &&
        (policies && policy ? (
          <>
            <Card title="نسخه‌ها">
              <p className="mb-2 text-sm">
                نسخهٔ فعال{' '}
                {policies.active.version === null
                  ? 'پیش‌فرض'
                  : formatAdminInteger(policies.active.version)}
              </p>
              {policies.history.length ? (
                <ul className="space-y-2">
                  {policies.history.map((row) => (
                    <li key={row.version} className="flex flex-wrap items-center gap-2 text-sm">
                      <ButtonLink
                        href={`${href(page)}&version=${row.version}`}
                        size="sm"
                        variant="outline"
                      >
                        نسخهٔ {formatAdminInteger(row.version ?? 0)}
                      </ButtonLink>
                      {row.publishedAt && (
                        <time dateTime={row.publishedAt}>
                          {formatAdminDateTime(row.publishedAt)}
                        </time>
                      )}
                      {row.publishedById && (
                        <bdi className="break-all text-xs">{row.publishedById}</bdi>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm">هنوز نسخه‌ای منتشر نشده است.</p>
              )}
            </Card>
            <ReferralRiskPolicyForm
              key={`${policy.version}:${policies.active.version}`}
              policy={policy}
              expectedVersion={policies.active.version}
              canPublish={canWrite}
              caseOptions={policyCaseOptions}
              selectedCase={detail?.attributionId ?? null}
            />
          </>
        ) : (
          <Alert tone="danger" action={<ButtonLink href={href(page)}>تلاش دوباره</ButtonLink>}>
            دریافت سیاست انجام نشد.
          </Alert>
        ))}
      {view === 'cases' && (
        <>
          <Card title="صف پرونده‌های معرفی">
            <nav aria-label="وضعیت پرونده‌ها" className="mb-3 flex flex-wrap gap-2">
              {(Object.keys(queues) as Array<keyof typeof queues>).map((key) => (
                <ButtonLink
                  key={key}
                  href={`${referralRiskPath}?queue=${key}`}
                  size="sm"
                  aria-current={queue === key ? 'page' : undefined}
                  variant={queue === key ? 'primary' : 'outline'}
                >
                  {queues[key]}
                </ButtonLink>
              ))}
            </nav>
            {!cases ? (
              <Alert tone="danger" action={<ButtonLink href={href(page)}>تلاش دوباره</ButtonLink>}>
                دریافت صف انجام نشد.
              </Alert>
            ) : cases.items.length ? (
              <ul className="divide-y divide-[var(--admin-color-border)]">
                {cases.items.map((row) => (
                  <li
                    key={row.attributionId}
                    className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
                  >
                    <div>
                      <p>
                        {actionLabels[row.action]} · امتیاز {formatAdminInteger(row.score)} ·
                        اطمینان {confidenceLabels[row.confidence]}
                      </p>
                      {row.dueAt && (
                        <p>
                          {row.overdue ? 'مهلت گذشته' : 'مهلت بررسی'} ·{' '}
                          {formatAdminDateTime(row.dueAt)}
                        </p>
                      )}
                      <bdi className="break-all text-xs">{row.attributionId}</bdi>
                    </div>
                    <ButtonLink
                      href={`${href(page)}&case=${row.attributionId}#risk-case`}
                      size="sm"
                      variant="outline"
                    >
                      مشاهدهٔ پرونده
                    </ButtonLink>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm">در این صفحه پرونده‌ای ثبت نشده است.</p>
            )}
          </Card>
          {id &&
            (!detail ? (
              <Alert tone="danger">دریافت پرونده انجام نشد.</Alert>
            ) : (
              <Card id="risk-case" title="جزئیات و سابقهٔ پرونده">
                <div className="space-y-4">
                  <ButtonLink
                    href={`${referralRiskPath}?view=policy&case=${detail.attributionId}`}
                    size="sm"
                    variant="outline"
                  >
                    استفاده از پرونده در تنظیمات ریسک
                  </ButtonLink>
                  <dl className="grid gap-2 text-sm sm:grid-cols-2">
                    <dt>شناسهٔ معرفی</dt>
                    <dd>
                      <bdi className="break-all">{detail.attributionId}</bdi>
                    </dd>
                    <dt>نتیجهٔ خودکار</dt>
                    <dd>{actionLabels[detail.autoAction]}</dd>
                    <dt>تصمیم فعلی</dt>
                    <dd>{actionLabels[detail.action]}</dd>
                    <dt>نسخهٔ سیاست</dt>
                    <dd>
                      {detail.policyVersion === null
                        ? 'پیش‌فرض'
                        : formatAdminInteger(detail.policyVersion)}
                    </dd>
                    <dt>زمان ارزیابی</dt>
                    <dd>{formatAdminDateTime(detail.assessedAt)}</dd>
                    <dt>پایان نگهداری شواهد</dt>
                    <dd>{formatAdminDateTime(detail.expiresAt)}</dd>
                    {user.permissions.includes('orders.read') && (
                      <>
                        <dt>سفارش</dt>
                        <dd>
                          <ButtonLink
                            href={`/orders?orderId=${detail.orderId}`}
                            size="sm"
                            variant="outline"
                          >
                            مشاهدهٔ سفارش
                          </ButtonLink>
                        </dd>
                      </>
                    )}
                  </dl>
                  <section aria-label="شواهد ارزیابی" className="space-y-2 text-sm">
                    <h3 className="font-bold">شواهد</h3>
                    {detail.evidence === null ? (
                      <p>مهلت نگهداری شواهد پایان یافته است.</p>
                    ) : detail.evidence.length ? (
                      <ul>
                        {detail.evidence.map(({ code, value, weight }) => (
                          <li key={code}>
                            {riskLabels[code]} · مقدار {formatAdminInteger(value)} · وزن{' '}
                            {formatAdminInteger(weight)}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>سیگنال منطبقی ثبت نشده است.</p>
                    )}
                  </section>
                  {canWrite && (
                    <ReferralRiskReviewForm
                      key={`${id}:${detail.revision}`}
                      caseId={id}
                      revision={detail.revision}
                    />
                  )}
                  <section aria-label="تاریخچهٔ تصمیم‌ها" className="space-y-2 text-sm">
                    <h3 className="font-bold">تاریخچهٔ تصمیم‌ها</h3>
                    {!detail.reviews.length ? (
                      <p>تصمیم دستی ثبت نشده است.</p>
                    ) : (
                      <ol className="divide-y divide-[var(--admin-color-border)]">
                        {detail.reviews.map((row) => (
                          <li key={row.revision} className="py-2">
                            <p>
                              {actionLabels[row.fromAction]} ← {actionLabels[row.action]} ·{' '}
                              {formatAdminDateTime(row.recordedAt)}
                            </p>
                            <p>{row.reason}</p>
                            <bdi className="break-all text-xs">{row.actorUserId}</bdi>
                          </li>
                        ))}
                      </ol>
                    )}
                  </section>
                </div>
              </Card>
            ))}
        </>
      )}
      {(page > 1 || hasMore) && (
        <nav aria-label="صفحه‌بندی" className="flex flex-wrap items-center gap-2">
          {page > 1 && (
            <ButtonLink href={href(page - 1)} size="sm" variant="outline">
              صفحهٔ قبل
            </ButtonLink>
          )}
          <span>صفحهٔ {formatAdminInteger(page)}</span>
          {hasMore && page < 10_000 && (
            <ButtonLink href={href(page + 1)} size="sm" variant="outline">
              صفحهٔ بعد
            </ButtonLink>
          )}
        </nav>
      )}
    </main>
  );
}
