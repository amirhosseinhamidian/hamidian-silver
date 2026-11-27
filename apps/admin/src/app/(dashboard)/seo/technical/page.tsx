import type { components } from '@hamidian/contracts';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { hasAllAdminPermissions } from '@/lib/auth/access-control';
import { createAdminApiClient } from '@/lib/auth/server-api';
import { requireAdminSession } from '@/lib/auth/session';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { formatAdminDateTime, formatAdminInteger } from '@/lib/presentation/formatters';
import { refreshTechnicalAudit, startTechnicalAudit } from './actions';

type AuditCheck = components['schemas']['SeoAuditCheckDto'];

const findingLabels: Record<string, string> = {
  SITEMAP_UNAVAILABLE: 'خواندن Sitemap ممکن نشد',
  CRAWL_UNVERIFIED: 'خزش کامل نشد',
  BROKEN_INTERNAL_LINK: 'لینک داخلی شکسته',
  SITEMAP_NOT_FOUND: 'آدرس Sitemap در دسترس نیست',
  BUYABLE_PRODUCT_NOT_FOUND: 'محصول دارای موجودی در دسترس نیست',
  REDIRECT_LOOP: 'حلقهٔ تغییر مسیر',
  REDIRECT_LIMIT: 'زنجیرهٔ طولانی تغییر مسیر',
  SITEMAP_REDIRECT: 'آدرس Sitemap تغییر مسیر دارد',
  EXPECTED_REDIRECT_MISSING: 'تغییر مسیر دائمی مورد انتظار دیده نشد',
  SITEMAP_NOINDEX: 'آدرس Sitemap دارای noindex',
  EXPECTED_NOINDEX_MISSING: 'دستور noindex مورد انتظار دیده نشد',
  CONFLICTING_CANONICALS: 'Canonicalهای متناقض',
  UNEXPECTED_CANONICAL: 'Canonical نیازمند بررسی',
  SITEMAP_NONCANONICAL: 'Sitemap شامل آدرس غیر Canonical است',
  MISSING_CANONICAL: 'Canonical دیده نشد',
  MISSING_TITLE: 'عنوان صفحه دیده نشد',
  MISSING_DESCRIPTION: 'توضیح متا دیده نشد',
  INVALID_JSON_LD: 'JSON-LD نامعتبر',
  SIMILAR_METADATA: 'عنوان و توضیح متای مشابه',
  PRODUCT_DEPTH_SAMPLE: 'دسترسی محصول در نمونهٔ لینک‌ها نیازمند بررسی است',
};

function displayPath(path: string) {
  try {
    return decodeURI(path);
  } catch {
    return path;
  }
}

function Evidence({ check }: Readonly<{ check: AuditCheck }>) {
  const observation = check.observation;
  return (
    <details
      id={`check-${check.path}`}
      className="min-w-0 rounded-lg border border-[var(--admin-color-border)] p-3"
    >
      <summary className="cursor-pointer break-all text-sm">
        <bdi dir="ltr">{displayPath(check.path)}</bdi>
        {' · '}
        {check.checkedAt
          ? observation?.status
            ? `HTTP ${observation.status}`
            : 'بدون پاسخ HTTP'
          : 'در صف بررسی'}
        {check.issues.length ? ` · ${formatAdminInteger(check.issues.length)} مورد` : ''}
      </summary>
      {check.issues.length > 0 && (
        <ul className="mt-3 space-y-3">
          {check.issues.map((issue) => (
            <li key={issue.code} className="space-y-1 text-sm">
              <p className="font-semibold">{findingLabels[issue.code] ?? issue.code}</p>
              <p>
                {issue.severity === 'ERROR' ? 'خطا' : 'نیازمند بازبینی'} ·{' '}
                {issue.state === 'NEW' ? 'جدید' : 'مشاهده‌شده در اجرای پیشین'}
              </p>
              {[...new Set(issue.evidence)].map((item) => (
                <bdi dir="auto" className="block break-all" key={item}>
                  {displayPath(item)}
                </bdi>
              ))}
            </li>
          ))}
        </ul>
      )}
      {observation && (
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-[auto_minmax(0,1fr)]">
          <dt>آدرس نهایی</dt>
          <dd className="break-all">
            <bdi dir="ltr">{displayPath(observation.finalPath)}</bdi>
          </dd>
          <dt>Sitemap</dt>
          <dd>{check.inSitemap === null ? 'نامشخص' : check.inSitemap ? 'موجود' : 'غایب'}</dd>
          <dt>Canonical</dt>
          <dd className="break-all">
            <bdi dir="ltr">{observation.canonicals.join(' · ') || '—'}</bdi>
          </dd>
          <dt>Robots</dt>
          <dd className="break-all">
            <bdi dir="ltr">{observation.robots.join(' · ') || '—'}</bdi>
          </dd>
          <dt>عنوان</dt>
          <dd className="break-words">{observation.title ?? '—'}</dd>
          <dt>توضیح متا</dt>
          <dd className="break-words">{observation.description ?? '—'}</dd>
          <dt>نوع Schema</dt>
          <dd className="break-all">
            <bdi dir="ltr">{observation.schema.join(' · ') || '—'}</bdi>
          </dd>
          {observation.redirects.length > 0 && (
            <>
              <dt>تغییر مسیر</dt>
              <dd className="break-all">
                <bdi dir="ltr">
                  {observation.redirects
                    .map(({ status, to }) => `${status} → ${to ?? '—'}`)
                    .join(' · ')}
                </bdi>
              </dd>
            </>
          )}
          {check.sourcePath && (
            <>
              <dt>مسیر لینک‌دهنده</dt>
              <dd className="break-all">
                <bdi dir="ltr">{displayPath(check.sourcePath)}</bdi>
              </dd>
            </>
          )}
          {check.checkedAt && (
            <>
              <dt>زمان بررسی</dt>
              <dd>{formatAdminDateTime(check.checkedAt)}</dd>
            </>
          )}
        </dl>
      )}
    </details>
  );
}

export const dynamic = 'force-dynamic';

export default async function TechnicalAuditPage({
  searchParams,
}: Readonly<{ searchParams: Promise<Record<string, string | string[] | undefined>> }>) {
  const user = await requireAdminSession({
    permissions: ['settings.read'],
    returnTo: '/seo/technical',
  });
  const { runId, result } = await searchParams;
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const selectedId = typeof runId === 'string' ? runId : undefined;
  let data: components['schemas']['SeoAuditOverviewDto'] | undefined;
  if (token) {
    try {
      ({ data } = await createAdminApiClient(token).GET('/api/v1/seo/technical-audits', {
        params: { query: { runId: selectedId } },
        cache: 'no-store',
      }));
    } catch {
      data = undefined;
    }
  }
  const current = data?.history[0];
  const checked = data?.checks.filter((check) => check.checkedAt).length ?? 0;
  const flagged = data?.checks.filter((check) => check.issues.length > 0) ?? [];
  const other = data?.checks.filter((check) => check.issues.length === 0) ?? [];

  return (
    <main className="admin-container space-y-6 py-6 sm:py-8 lg:py-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black">مشکلات فنی سئو</h1>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/seo" variant="outline">
            عملکرد جست‌وجو
          </ButtonLink>
          {data?.configured && hasAllAdminPermissions(user, ['settings.write']) && (
            <form action={startTechnicalAudit}>
              <Button type="submit" disabled={Boolean(current && !current.finishedAt)}>
                اجرای ممیزی
              </Button>
            </form>
          )}
        </div>
      </header>
      {result === 'running' && <p role="status">یک ممیزی در صف یا در حال اجراست.</p>}
      {result === 'unavailable' && <p role="alert">ثبت ممیزی ممکن نشد.</p>}
      {!data && <p role="alert">دریافت گزارش ممیزی ممکن نشد.</p>}
      {data && !data.configured && <p>نشانی عمومی فروشگاه برای ممیزی تنظیم نشده است.</p>}
      {data?.configured && !data.run && <p>هنوز ممیزی ثبت نشده است.</p>}
      {data?.run && (
        <>
          <Card title="گزارش ممیزی">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span>{formatAdminDateTime(data.run.createdAt)}</span>
              <span>نسخهٔ قواعد {formatAdminInteger(data.run.ruleVersion)}</span>
              <span>
                {formatAdminInteger(checked)} از {formatAdminInteger(data.checks.length)} آدرس
              </span>
              <span>
                {data.run.finishedAt
                  ? `پایان ${formatAdminDateTime(data.run.finishedAt)}`
                  : 'در صف یا در حال اجرا'}
              </span>
              <span>
                {data.run.sitemapChecked ? 'Sitemap خوانده شد' : 'نتیجهٔ Sitemap نامشخص است'}
              </span>
              {!data.run.finishedAt && (
                <form action={refreshTechnicalAudit}>
                  <Button variant="outline" type="submit">
                    به‌روزرسانی
                  </Button>
                </form>
              )}
            </div>
            <ul aria-label="اجراهای اخیر" className="mt-3 flex flex-wrap gap-3 text-sm">
              {data.history.map((run) => (
                <li key={run.id}>
                  <Link
                    className="underline underline-offset-4"
                    aria-current={run.id === data?.run?.id ? 'page' : undefined}
                    href={`/seo/technical?runId=${run.id}`}
                  >
                    {formatAdminDateTime(run.createdAt)}
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
          <Card title="آدرس‌های دارای مشکل">
            <div className="space-y-2">
              {flagged.length ? (
                flagged.map((check) => <Evidence check={check} key={check.path} />)
              ) : (
                <p>
                  {data.run.finishedAt
                    ? 'در آدرس‌های نمونه مشکلی ثبت نشد.'
                    : 'هنوز مشکلی ثبت نشده است.'}
                </p>
              )}
            </div>
          </Card>
          {other.length > 0 && (
            <Card title="سایر آدرس‌های نمونه">
              <div className="space-y-2">
                {other.map((check) => (
                  <Evidence check={check} key={check.path} />
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </main>
  );
}
