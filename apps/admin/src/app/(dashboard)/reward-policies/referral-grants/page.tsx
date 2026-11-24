import { cookies } from 'next/headers';
import { Alert } from '@/components/ui/alert';
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
import {
  actionLabels,
  referralRiskPath,
  type RiskAction,
} from '@/lib/reward-policies/referral-risk';

export const dynamic = 'force-dynamic';
const path = '/reward-policies/referral-grants';
const statusLabels = {
  PENDING: 'در انتظار',
  APPROVED: 'تأییدشده',
  REJECTED: 'ردشده',
  EXPIRED: 'منقضی‌شده',
} as const;
type Status = keyof typeof statusLabels;
const reasonLabels: Record<string, string> = {
  ATTRIBUTION_EXPIRED: 'مهلت معرفی پایان یافته',
  ORDER_INELIGIBLE: 'خرید اول واجد شرایط نیست',
  RISK_REJECTED: 'رد در بررسی ریسک',
  RISK_PENDING: 'در انتظار تأیید ریسک',
  DELIVERY_PENDING: 'در انتظار تحویل',
  RETURN_PENDING: 'در انتظار تعیین تکلیف مرجوعی',
  REFERRER_INELIGIBLE: 'سابقهٔ خرید معرف واجد شرایط نیست',
  POLICY_INELIGIBLE: 'نسخهٔ سیاست معرفی واجد شرایط نیست',
  WALLET_POLICY_INELIGIBLE: 'سیاست اعتباری در زمان پرداخت فعال نبوده',
  NO_MATCH: 'قانون منطبق پیدا نشد',
  USE_LIMIT: 'سقف دفعات استفاده تکمیل شده',
  BUDGET_LIMIT: 'سقف بودجه تکمیل شده',
  VALUE_LIMIT: 'مبلغ پاداش صفر است',
  ISSUED: 'اعتبار صادر شده',
  CORRECTED: 'اصلاح اعتبار ثبت شده',
  RECOVERY_DUE: 'اعتبار مصرف‌شده نیازمند پیگیری است',
  PROCESSING_ERROR: 'پردازش دوباره انجام می‌شود',
};
type Costs = {
  grantedToman: number;
  buyerDiscountToman: number;
  revokedToman: number;
  recoveryDueToman: number;
};
type Report = {
  totals: Costs & {
    registered: number;
    converted: number;
    pending: number;
    approved: number;
    rejected: number;
    expired: number;
    flagged: number;
  };
  items: (Costs & {
    id: string;
    orderId: string | null;
    claimedAt: string;
    status: Status;
    riskAction: RiskAction | null;
    policyVersion: number | null;
    ruleCode: string | null;
    resultCode: string | null;
    creditExpiresAt: string | null;
  })[];
  hasMore: boolean;
};
const countLabels = {
  pending: 'در انتظار',
  approved: 'تأییدشده',
  rejected: 'ردشده',
  expired: 'منقضی‌شده',
  flagged: 'دارای پرچم ریسک',
} as const;
const costLabels = {
  buyerDiscountToman: 'تخفیف خرید اول',
  grantedToman: 'اعتبار صادرشدهٔ معرف',
  revokedToman: 'اعتبار کسرشده',
  recoveryDueToman: 'اعتبار نیازمند پیگیری',
} as const;

export default async function ReferralGrantPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ page?: string; days?: string; status?: string }> }>) {
  const user = await requireAdminSession({ permissions: ['finance.read'], returnTo: path });
  const canReadOrders = user.permissions.includes('orders.read');
  const query = await searchParams;
  const numericPage = Number(query.page);
  const page =
    Number.isInteger(numericPage) && numericPage >= 1 && numericPage <= 10_000 ? numericPage : 1;
  const days = query.days === '90' || query.days === '365' ? query.days : '30';
  const status = (Object.keys(statusLabels) as Status[]).find((key) => key === query.status);
  const href = (next: number, state = status, period = days) =>
    `${path}?days=${period}&page=${next}${state ? `&status=${state}` : ''}`;
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  let report: Report | null = null;
  if (token) {
    try {
      const response = await requestAdminCatalog(
        `/api/v1/referral-grants?days=${days}&page=${page}${status ? `&status=${status}` : ''}`,
        token,
      );
      if (response.ok) report = (await readJsonResponse(response)) as Report;
    } catch {
      report = null;
    }
  }
  const totals = report?.totals;
  const rate = new Intl.NumberFormat('fa-IR', { style: 'percent', maximumFractionDigits: 1 });
  return (
    <main className="admin-container space-y-6 py-6 sm:py-8 lg:py-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black sm:text-3xl">گزارش پاداش معرفی</h1>
        <nav className="flex flex-wrap gap-2" aria-label="عملیات معرفی">
          <ButtonLink href="/reward-policies/referrals" variant="outline" size="sm">
            سیاست پاداش معرفی
          </ButtonLink>
          <ButtonLink href={referralRiskPath} variant="outline" size="sm">
            بررسی ریسک معرفی
          </ButtonLink>
        </nav>
      </header>
      <nav className="flex flex-wrap gap-2" aria-label="بازهٔ ثبت معرفی">
        {(['30', '90', '365'] as const).map((period) => (
          <ButtonLink
            key={period}
            href={href(1, status, period)}
            size="sm"
            variant={days === period ? 'primary' : 'outline'}
            aria-current={days === period ? 'page' : undefined}
          >
            {formatAdminInteger(Number(period))} روز اخیر
          </ButtonLink>
        ))}
      </nav>
      {report && totals ? (
        <>
          <Card title="معرفی و تبدیل">
            <p className="mb-4 text-sm">
              نرخ تبدیل، سهم معرفی‌های ثبت‌شده در این بازه با خرید اول تحویل‌شده و مستردنشدهٔ کامل
              است.
            </p>
            <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt>معرفی ثبت‌شده</dt>
                <dd className="font-bold">{formatAdminInteger(totals.registered)}</dd>
              </div>
              <div>
                <dt>خرید تکمیل‌شده</dt>
                <dd className="font-bold">{formatAdminInteger(totals.converted)}</dd>
              </div>
              <div>
                <dt>نرخ تبدیل</dt>
                <dd className="font-bold">
                  {totals.registered ? rate.format(totals.converted / totals.registered) : '—'}
                </dd>
              </div>
              {Object.entries(countLabels).map(([key, label]) => (
                <div key={key}>
                  <dt>{label}</dt>
                  <dd className="font-bold">
                    {formatAdminInteger(totals[key as keyof typeof countLabels])}
                  </dd>
                </div>
              ))}
            </dl>
          </Card>
          <Card title="هزینه و اصلاح اعتبار">
            <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
              {Object.entries(costLabels).map(([key, label]) => (
                <div key={key}>
                  <dt>{label}</dt>
                  <dd className="font-bold">{formatAdminToman(totals[key as keyof Costs])}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-sm">
              مبالغ مشوق از سفارش و دفتر اعتبار خوانده می‌شوند. هزینهٔ تأمین کالا در این گزارش لحاظ
              نمی‌شود.
            </p>
          </Card>
          <Card title="معرفی‌ها">
            <nav className="mb-4 flex flex-wrap gap-2" aria-label="وضعیت پاداش">
              <ButtonLink
                href={`${path}?days=${days}`}
                size="sm"
                variant={status ? 'outline' : 'primary'}
                aria-current={status ? undefined : 'page'}
              >
                همه
              </ButtonLink>
              {(Object.keys(statusLabels) as Status[]).map((key) => (
                <ButtonLink
                  key={key}
                  href={href(1, key)}
                  size="sm"
                  variant={status === key ? 'primary' : 'outline'}
                  aria-current={status === key ? 'page' : undefined}
                >
                  {statusLabels[key]}
                </ButtonLink>
              ))}
            </nav>
            {report.items.length ? (
              <ul className="divide-y divide-[var(--admin-color-border)] text-sm">
                {report.items.map((row) => (
                  <li key={row.id} className="grid gap-3 py-3 md:grid-cols-3">
                    <div className="space-y-1">
                      <time dateTime={row.claimedAt}>{formatAdminDateTime(row.claimedAt)}</time>
                      <p className="font-bold">{statusLabels[row.status]}</p>
                      {row.resultCode && <p>{reasonLabels[row.resultCode] ?? 'نیازمند پیگیری'}</p>}
                      {row.creditExpiresAt && (
                        <p>انقضا {formatAdminDateTime(row.creditExpiresAt)}</p>
                      )}
                    </div>
                    <dl className="space-y-1">
                      {Object.entries(costLabels).map(([key, label]) => (
                        <div key={key} className="flex flex-wrap gap-x-2">
                          <dt>{label}</dt>
                          <dd>{formatAdminToman(row[key as keyof Costs])}</dd>
                        </div>
                      ))}
                    </dl>
                    <div className="flex flex-wrap items-start gap-2">
                      {row.policyVersion && (
                        <span>
                          نسخهٔ {formatAdminInteger(row.policyVersion)}{' '}
                          {row.ruleCode && <bdi>{row.ruleCode}</bdi>}
                        </span>
                      )}
                      {row.riskAction && (
                        <ButtonLink
                          href={`${referralRiskPath}?case=${row.id}`}
                          variant="outline"
                          size="sm"
                        >
                          {actionLabels[row.riskAction]}
                        </ButtonLink>
                      )}
                      {canReadOrders && row.orderId && (
                        <ButtonLink
                          href={`/orders?orderId=${row.orderId}`}
                          variant="outline"
                          size="sm"
                        >
                          سفارش اول
                        </ButtonLink>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm">معرفی‌ای در این بازه و وضعیت ثبت نشده است.</p>
            )}
            <nav className="mt-4 flex flex-wrap items-center gap-2" aria-label="صفحه‌بندی معرفی‌ها">
              {page > 1 && (
                <ButtonLink href={href(page - 1)} variant="outline" size="sm">
                  صفحهٔ پیش
                </ButtonLink>
              )}
              <span className="text-sm">صفحهٔ {formatAdminInteger(page)}</span>
              {report.hasMore && page < 10_000 && (
                <ButtonLink href={href(page + 1)} variant="outline" size="sm">
                  صفحهٔ بعد
                </ButtonLink>
              )}
            </nav>
          </Card>
        </>
      ) : (
        <Alert
          tone="danger"
          action={
            <ButtonLink href={href(page)} size="sm">
              تلاش دوباره
            </ButtonLink>
          }
        >
          دریافت گزارش پاداش معرفی انجام نشد.
        </Alert>
      )}
    </main>
  );
}
