import type { components } from '@hamidian/contracts';
import Link from 'next/link';

import { CampaignReportPeriod } from '@/components/growth/campaign-report-period';
import { Alert } from '@/components/ui/alert';
import { ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  formatAdminDateTime,
  formatAdminInteger,
  formatAdminToman,
} from '@/lib/presentation/formatters';

type CampaignPerformance = components['schemas']['GrowthCampaignPerformanceDto'];
const ratio = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 2 });
const unknown = 'داده موجود نیست';
const cell = 'border-b border-[var(--admin-color-border)] px-3 py-2.5 text-start';
const money = (value: number | null) => (value === null ? unknown : formatAdminToman(value));

function Figures({ items }: { items: readonly (readonly [string, string])[] }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-md bg-[var(--admin-color-surface-subtle)] p-3">
          <dt className="text-sm text-[var(--admin-color-muted)]">{label}</dt>
          <dd className="mt-1 font-bold">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function GrowthCampaignPerformanceView({
  report,
  status,
  from,
  to,
  path,
  canReadOrders,
}: {
  report: CampaignPerformance | null;
  status: number;
  from: string;
  to: string;
  path: string;
  canReadOrders: boolean;
}) {
  const totals = report?.totals;
  const budget = report?.budget;
  const pageHref = (page: number) =>
    `${path}?${new URLSearchParams({ from, to, page: String(page) })}#campaign-history`;
  const costsHref = report
    ? `/growth?${new URLSearchParams({ from, to, campaignId: report.campaignId })}#cost-history`
    : '/growth';

  return (
    <main className="admin-container space-y-5 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">عملکرد کمپین</h1>
          {report && (
            <p className="mt-1">
              {report.campaign} · <bdi>{report.campaignId}</bdi>
            </p>
          )}
        </div>
        <ButtonLink href="/growth" variant="outline">
          داشبورد رشد
        </ButtonLink>
      </header>
      <Card title="بازهٔ گزارش" description="روزها به وقت تهران محاسبه می‌شوند. حداکثر ۹۲ روز.">
        <CampaignReportPeriod key={`${from}/${to}`} path={path} from={from} to={to} />
      </Card>
      {report && totals ? (
        <>
          <Card
            title="فروش منتسب و هزینهٔ رسانه"
            action={
              <ButtonLink size="sm" variant="outline" href={costsHref}>
                هزینه‌ها و اصلاحیه‌ها
              </ButtonLink>
            }
          >
            <Figures
              items={[
                [
                  'نشست سنجیده‌شده',
                  totals.measuredVisits === null
                    ? unknown
                    : formatAdminInteger(totals.measuredVisits),
                ],
                ['سفارش ثبت‌شده', formatAdminInteger(totals.submittedOrders)],
                ['خرید تأییدشده', formatAdminInteger(totals.confirmedOrders)],
                ['مشتری با نخستین خرید قطعی', formatAdminInteger(report.newCustomers)],
                ['وصول قطعی', money(totals.collectedToman)],
                ['بازپرداخت قطعی', money(totals.refundedToman)],
                ['وصول خالص', money(totals.netCollectedToman)],
                ['هزینهٔ ثبت‌شدهٔ رسانه', money(totals.recordedSpendToman)],
                ['هزینهٔ جذب مشتری (CAC)', money(report.cacToman)],
                [
                  'بازده هزینهٔ رسانه (ROAS)',
                  report.roas === null ? unknown : `${ratio.format(report.roas)} برابر`,
                ],
              ]}
            />
            <ul className="mt-4 space-y-2 text-sm text-[var(--admin-color-muted)]">
              <li>
                نشست‌ها از رویدادهای اختیاری مرورگر می‌آیند. خرید و بازپرداخت در روز تأیید پرداخت یا
                بازپرداخت شمرده می‌شوند.
              </li>
              <li>
                CAC برابر هزینهٔ ثبت‌شدهٔ رسانه تقسیم بر تعداد مشتریانی است که نخستین خرید قطعی
                آن‌ها به این کمپین منتسب شده است. ROAS برابر وصول پس از کسر بازپرداخت تقسیم بر همان
                هزینه است.
              </li>
              <li>
                هر دو شاخص به هزینهٔ مثبت و ثبت هزینه برای کانال‌های دارای خرید قطعی نیاز دارند. ثبت
                دستی ممکن است بخشی از هزینهٔ واقعی را پوشش دهد. سود خالص بدون هزینهٔ تأمین قابل
                محاسبه نیست.
              </li>
            </ul>
          </Card>
          <Card title="تخفیف و اعتبار در بازه">
            <Figures
              items={[
                ['تخفیف کالای کمپین در خرید قطعی', money(report.merchandiseDiscountToman)],
                ['تخفیف ارسال کمپین در خرید قطعی', money(report.shippingDiscountToman)],
                ['اعتبار مصرف‌شده', money(report.consumedCreditToman)],
                ['پاداش صادرشده', money(report.issuedRewardToman)],
              ]}
            />
            <p className="mt-3 text-sm text-[var(--admin-color-muted)]">
              تخفیف به کمپینی تعلق دارد که مبلغ را در سفارش ثبت کرده است.
            </p>
          </Card>
          <Card
            title="انحراف از بودجه"
            description="همهٔ ثبت‌های هزینه و تعهدهای فعلی کمپین. فیلتر تاریخ در این بخش اعمال نمی‌شود."
          >
            {budget ? (
              <Figures
                items={[
                  ['سقف کل بودجه', money(budget.budgetToman)],
                  ['هزینهٔ برنامه‌ریزی‌شدهٔ رسانه', money(budget.plannedChannelCostToman)],
                  ['هزینهٔ ثبت‌شدهٔ رسانه', money(budget.lifetimeMediaSpendToman)],
                  ['اختلاف ثبت رسانه با برنامه', money(budget.mediaVarianceToman)],
                  ['مجموع تخفیف تعهدشده', money(budget.lifetimeCommittedDiscountToman)],
                  ...('lifetimeCommittedReferralRewardToman' in budget &&
                  typeof budget.lifetimeCommittedReferralRewardToman === 'number'
                    ? [
                        [
                          'پاداش معرف صادرشده',
                          money(budget.lifetimeCommittedReferralRewardToman),
                        ] as const,
                      ]
                    : []),
                  [
                    'سهم سفارش‌های پرداخت‌نشده از تعهد تخفیف',
                    money(budget.unpaidDiscountCommitmentToman),
                  ],
                  ['اختلاف هزینه و تعهد با سقف بودجه', money(budget.budgetVarianceToman)],
                ]}
              />
            ) : (
              <p className="text-sm">برای این شناسهٔ ردیابی، بودجهٔ کمپین تعریف نشده است.</p>
            )}
            {budget && (
              <p className="mt-3 text-sm text-[var(--admin-color-muted)]">
                اختلاف مثبت یعنی هزینهٔ ثبت‌شده و تعهد تخفیف و پاداش معرف از سقف گذشته‌اند. سفارش
                پرداخت‌نشده بخشی از مجموع تعهد است.
              </p>
            )}
          </Card>
          <Card
            title="تعهد باز پاداش"
            description="ماندهٔ پاداش‌های صادرشده پس از خرج، انقضا و اصلاحیه. مبلغ این بخش پس از اتصال دفتر کیف پول در دسترس خواهد بود."
          >
            <p className="font-bold">{money(report.outstandingRewardCommitmentToman)}</p>
          </Card>
          <Card id="campaign-history" title="تاریخچهٔ انتساب و لغو">
            {report.history.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[47rem] text-sm">
                  <thead>
                    <tr>
                      {[
                        'زمان',
                        'رویداد',
                        'سفارش',
                        'کمپین تماس اول',
                        'کمپین تماس آخر',
                        'کمپین منتخب و نسخهٔ سیاست',
                      ].map((label) => (
                        <th className={cell} key={label} scope="col">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.history.map((item) => (
                      <tr key={`${item.kind}-${item.orderId}`}>
                        <td className={cell}>{formatAdminDateTime(item.occurredAt)}</td>
                        <td className={cell}>
                          {item.kind === 'attribution' ? 'ثبت انتساب' : 'لغو سفارش'}
                        </td>
                        <td className={cell}>
                          {canReadOrders ? (
                            <Link className="underline" href={`/orders?orderId=${item.orderId}`}>
                              جزئیات سفارش
                            </Link>
                          ) : (
                            <bdi>{item.orderId}</bdi>
                          )}
                        </td>
                        <td className={cell}>
                          <bdi>{item.firstCampaignId ?? '—'}</bdi>
                        </td>
                        <td className={cell}>
                          <bdi>{item.lastCampaignId ?? '—'}</bdi>
                        </td>
                        <td className={cell}>
                          <bdi>{item.selectedCampaignId ?? '—'}</bdi>
                          {item.model && item.policyVersion !== null ? (
                            <span className="block text-xs">
                              {item.model === 'FIRST_NON_DIRECT'
                                ? 'تماس اول غیرمستقیم'
                                : 'تماس آخر غیرمستقیم'}{' '}
                              · نسخهٔ {formatAdminInteger(item.policyVersion)}
                            </span>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm">در این صفحه رویدادی برای بازهٔ انتخاب‌شده ثبت نشده است.</p>
            )}
            {report.page > 1 || report.hasMoreHistory ? (
              <nav
                aria-label="صفحات تاریخچهٔ کمپین"
                className="mt-4 flex flex-wrap items-center gap-2"
              >
                {report.page > 1 && (
                  <ButtonLink size="sm" variant="outline" href={pageHref(report.page - 1)}>
                    قبلی
                  </ButtonLink>
                )}
                <span>صفحهٔ {formatAdminInteger(report.page)}</span>
                {report.hasMoreHistory && report.page < 10_000 && (
                  <ButtonLink size="sm" variant="outline" href={pageHref(report.page + 1)}>
                    بعدی
                  </ButtonLink>
                )}
              </nav>
            ) : null}
          </Card>
        </>
      ) : (
        <Alert tone="danger">
          {status === 404
            ? 'کمپین پیدا نشد.'
            : status === 400
              ? 'بازهٔ انتخاب‌شده معتبر نیست.'
              : 'دریافت گزارش کمپین ممکن نشد.'}
        </Alert>
      )}
    </main>
  );
}
