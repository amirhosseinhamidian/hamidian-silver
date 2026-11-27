import { cookies } from 'next/headers';
import { GrowthIssuanceForm } from '@/components/reward-policies/growth-issuance-form';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { requireAdminSession } from '@/lib/auth/session';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { readJsonResponse, requestAdminCatalog } from '@/lib/catalog/catalog-api';
import { parseGrowthFilters } from '@/lib/growth/growth-report';
import { formatAdminInteger, formatAdminToman } from '@/lib/presentation/formatters';
import {
  apiFlagLabels,
  readIssuanceState,
  type ApiFlag,
} from '@/lib/reward-policies/growth-rollout';
import { asObject } from '@/lib/reward-policies/policy-simulator';

const path = '/reward-policies/rollout';
export const dynamic = 'force-dynamic';

async function readReport(token: string | undefined, endpoint: string) {
  if (!token) return null;
  try {
    const response = await requestAdminCatalog('/api/v1' + endpoint, token, {
      signal: AbortSignal.timeout(5_000),
    });
    return response.ok ? asObject(await readJsonResponse(response)) : null;
  } catch {
    return null;
  }
}

async function probeStorefront() {
  const origin = process.env.STOREFRONT_HEALTH_ORIGIN;
  if (!origin) return null;
  const startedAt = performance.now();
  try {
    const response = await fetch(new URL('/api/health', origin), {
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(3_000),
    });
    return { ok: response.ok, elapsed: Math.round(performance.now() - startedAt) };
  } catch {
    return { ok: false, elapsed: null };
  }
}

function measure(value: unknown, format = formatAdminInteger) {
  return typeof value === 'number' && Number.isFinite(value) ? format(value) : 'در دسترس نیست';
}

function Measurements({ rows }: { rows: readonly [string, string][] }) {
  return (
    <dl className="space-y-2 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="flex flex-wrap justify-between gap-2">
          <dt className="text-[var(--admin-color-muted)]">{label}</dt>
          <dd className="font-semibold">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export default async function GrowthRolloutPage() {
  const user = await requireAdminSession({ permissions: ['finance.read'], returnTo: path });
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const { from, to } = parseGrowthFilters({});
  const period = new URLSearchParams({ from, to, page: '1', limit: '1' });
  const [flags, payment, wallet, jobs, growth, storefront] = await Promise.all([
    readReport(token, '/wallet/admin/credit-issuance'),
    readReport(token, '/payments/operations/summary'),
    readReport(token, '/wallet/admin/maintenance/report?status=open'),
    readReport(token, '/wallet/admin/purchase-reward-jobs'),
    readReport(token, '/growth-attribution/dashboard?' + period.toString()),
    probeStorefront(),
  ]);
  const state = readIssuanceState(flags);
  const walletTotals = asObject(wallet?.totals);
  const growthTotals = asObject(growth?.totals);
  const jobCounts = Array.isArray(jobs?.statuses) ? jobs.statuses.map(asObject) : [];
  const deadJob = jobCounts.find((entry) => entry?.status === 'DEAD_LETTER');
  const openWalletIssues = Array.isArray(wallet?.issues)
    ? formatAdminInteger(wallet.issues.length) + (wallet.hasMore ? '+' : '')
    : 'در دسترس نیست';

  return (
    <main className="admin-container space-y-5 py-6 sm:py-8 lg:py-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black">وضعیت انتشار و صدور اعتبار</h1>
        <nav className="flex flex-wrap gap-2" aria-label="ناوبری وضعیت انتشار">
          <ButtonLink href={path} variant="outline" size="sm">
            بارگیری وضعیت
          </ButtonLink>
          <ButtonLink href="/reward-policies" variant="outline" size="sm">
            بازگشت به پاداش خرید
          </ButtonLink>
        </nav>
      </header>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          title="کنترل صدور"
          description="سفارش، تسویه و رسیدگی به اعتبارهای قبلی در زمان توقف ادامه دارند."
        >
          {state ? (
            <GrowthIssuanceForm
              key={state.version}
              initial={state}
              canWrite={user.permissions.includes('finance.write')}
            />
          ) : (
            <Alert tone="danger">دریافت وضعیت صدور انجام نشد.</Alert>
          )}
        </Card>
        <Card title="کنترل‌های محیط API">
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            {(Object.keys(apiFlagLabels) as ApiFlag[]).map((key) => (
              <div key={key} className="flex items-center justify-between gap-2">
                <dt>{apiFlagLabels[key]}</dt>
                <dd>
                  {typeof flags?.[key] === 'boolean' ? (
                    <Badge tone={flags[key] ? 'success' : 'neutral'}>
                      {flags[key] ? 'روشن' : 'خاموش'}
                    </Badge>
                  ) : (
                    'در دسترس نیست'
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </Card>
        <Card
          title="پرداخت و پردازش پاداش"
          description="خلاصهٔ عملیات پرداخت از میان حداکثر ۱۰۰ پرونده در هر گروه است."
        >
          <Measurements
            rows={[
              ['تطبیق‌های باز پرداخت', measure(payment?.openReconciliations)],
              ['تلاش‌های معطل آغاز پرداخت', measure(payment?.stuckInitiations)],
              ['تلاش‌های نیازمند پیگیری فوری', measure(payment?.escalatedInitiations)],
              ['کارهای سررسیدشدهٔ پاداش خرید', measure(jobs?.due)],
              [
                'کارهای ناموفق نهایی پاداش خرید',
                measure(deadJob?.count ?? (Array.isArray(jobs?.statuses) ? 0 : null)),
              ],
            ]}
          />
          <ButtonLink href="/reconciliations" className="mt-3" size="sm" variant="outline">
            پرونده‌های تطبیق پرداخت
          </ButtonLink>
        </Card>
        <Card title="تعهد و مغایرت کیف پول">
          <Measurements
            rows={[
              ['اعتبار قابل مصرف', measure(walletTotals?.availableToman, formatAdminToman)],
              ['اعتبار در انتظار فعال‌سازی', measure(walletTotals?.pendingToman, formatAdminToman)],
              ['اعتبار رزروشده', measure(walletTotals?.reservedToman, formatAdminToman)],
              ['موارد باز در گزارش مغایرت', openWalletIssues],
            ]}
          />
          <ButtonLink
            href="/reward-policies/maintenance"
            className="mt-3"
            size="sm"
            variant="outline"
          >
            گزارش تطبیق کیف پول
          </ButtonLink>
        </Card>
        <Card title="مشوق و ترافیک سنجیده‌شده" description={`${from} تا ${to} به وقت تهران`}>
          <Measurements
            rows={[
              [
                'تخفیف ثبت‌شده در خرید قطعی',
                measure(growthTotals?.orderDiscountToman, formatAdminToman),
              ],
              [
                'اعتبار مصرف‌شده در خرید قطعی',
                measure(growthTotals?.walletAppliedToman, formatAdminToman),
              ],
              ['نشست‌های سنجیده‌شده', measure(growthTotals?.measuredVisits)],
            ]}
          />
          <ButtonLink href="/growth" className="mt-3" size="sm" variant="outline">
            روند گزارش رشد
          </ButtonLink>
        </Card>
        <Card
          title="سلامت فروشگاه"
          description="یک نمونه از زمان پاسخ سلامت از پنل به سرویس فروشگاه."
        >
          <Measurements
            rows={[
              ['پاسخ سلامت', storefront ? (storefront.ok ? 'موفق' : 'خطا') : 'تنظیم نشده'],
              [
                'زمان نمونهٔ پاسخ',
                storefront?.elapsed == null
                  ? 'در دسترس نیست'
                  : formatAdminInteger(storefront.elapsed) + ' میلی‌ثانیه',
              ],
            ]}
          />
        </Card>
      </div>
    </main>
  );
}
