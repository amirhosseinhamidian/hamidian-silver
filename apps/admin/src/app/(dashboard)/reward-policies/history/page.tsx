import { cookies } from 'next/headers';
import { Alert } from '@/components/ui/alert';
import { ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { requireAdminSession } from '@/lib/auth/session';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { readJsonResponse, requestAdminCatalog } from '@/lib/catalog/catalog-api';
import { formatAdminDateTime, formatAdminInteger } from '@/lib/presentation/formatters';
import type { PolicyVersion, PolicyVersionPage } from '@/lib/reward-policies/wallet-operations';

export const dynamic = 'force-dynamic';
const path = '/reward-policies/history';

export default async function RewardPolicyHistory({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ page?: string; version?: string }>;
}>) {
  await requireAdminSession({ permissions: ['finance.read'], returnTo: path });
  const query = await searchParams;
  const requested = Number(query.page);
  const page = Number.isInteger(requested) && requested >= 1 && requested <= 10_000 ? requested : 1;
  const version = Number(query.version);
  const selected = Number.isInteger(version) && version > 0 && version <= 2_147_483_647;
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  async function read<T>(suffix: string): Promise<T | null> {
    if (!token) return null;
    try {
      const response = await requestAdminCatalog(`/api/v1/reward-policies${suffix}`, token);
      return response.ok ? ((await readJsonResponse(response)) as T) : null;
    } catch {
      return null;
    }
  }
  const [history, detail] = await Promise.all([
    read<PolicyVersionPage>(`?page=${page}`),
    selected ? read<PolicyVersion>(`/${version}`) : null,
  ]);
  return (
    <main className="admin-container space-y-6 py-6 sm:py-8 lg:py-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black sm:text-3xl">تاریخچهٔ تنظیمات پاداش</h1>
        <ButtonLink href="/reward-policies" size="sm" variant="outline">
          پاداش خرید
        </ButtonLink>
      </header>
      {selected && (
        <Card title={`تنظیمات نسخهٔ ${formatAdminInteger(version)}`} id="version-detail">
          {detail ? (
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <dt>صدور پاداش</dt>
              <dd>{detail.definition.enabled ? 'فعال' : 'غیرفعال'}</dd>
              <dt>زمان فعال‌سازی</dt>
              <dd>
                {(detail.definition.activationDelayDays ?? 7) === 0
                  ? 'بلافاصله پس از تحویل'
                  : `${formatAdminInteger(detail.definition.activationDelayDays ?? 7)} روز پس از تحویل`}
              </dd>
              <dt>مهلت مصرف</dt>
              <dd>{formatAdminInteger(detail.definition.expiryDays)} روز پس از صدور</dd>
              <dt>زمان اثرگذاری</dt>
              <dd>{detail.effectiveAt ? formatAdminDateTime(detail.effectiveAt) : 'پیش‌نویس'}</dd>
              {detail.publishedById && (
                <>
                  <dt>شناسهٔ منتشرکننده</dt>
                  <dd>
                    <bdi>{detail.publishedById}</bdi>
                  </dd>
                </>
              )}
            </dl>
          ) : (
            <Alert tone="danger">دریافت جزئیات نسخه انجام نشد.</Alert>
          )}
        </Card>
      )}
      <Card title="نسخه‌های سیاست پاداش">
        {!history ? (
          <Alert tone="danger">دریافت تاریخچه انجام نشد.</Alert>
        ) : history.items.length ? (
          <ul className="divide-y divide-[var(--admin-color-border)]">
            {history.items.map((item) => (
              <li
                key={item.version}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="text-sm">
                  <strong>نسخهٔ {formatAdminInteger(item.version)}</strong>
                  <p>
                    {item.effectiveAt
                      ? `اثرگذاری از ${formatAdminDateTime(item.effectiveAt)}`
                      : `پیش‌نویس ${formatAdminDateTime(item.createdAt)}`}
                  </p>
                </div>
                <ButtonLink
                  href={`${path}?page=${page}&version=${item.version}#version-detail`}
                  size="sm"
                  variant="outline"
                >
                  مشاهدهٔ تنظیمات
                </ButtonLink>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm">در این صفحه نسخه‌ای ثبت نشده است.</p>
        )}
        {history && (page > 1 || history.hasMore) && (
          <nav aria-label="صفحه‌بندی نسخه‌ها" className="mt-4 flex flex-wrap items-center gap-3">
            {page > 1 && (
              <ButtonLink href={`${path}?page=${page - 1}`} size="sm" variant="outline">
                صفحهٔ قبل
              </ButtonLink>
            )}
            <span className="text-sm">صفحهٔ {formatAdminInteger(page)}</span>
            {history.hasMore && page < 10_000 && (
              <ButtonLink href={`${path}?page=${page + 1}`} size="sm" variant="outline">
                صفحهٔ بعد
              </ButtonLink>
            )}
          </nav>
        )}
      </Card>
    </main>
  );
}
