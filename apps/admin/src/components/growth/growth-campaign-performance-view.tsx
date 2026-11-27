import type { components } from '@hamidian/contracts';
import Link from 'next/link';

import { CampaignReportPeriod } from '@/components/growth/campaign-report-period';
import { Alert } from '@/components/ui/alert';
import { ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TableScrollRegion } from '@/components/ui/data-table';
import {
  discountCommitmentSignal,
  discountCommitmentThreshold,
} from '@/lib/growth/managerial-insights';
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
const integer = formatAdminInteger;
const percentage = (value: number | null) => (value === null ? unknown : `${ratio.format(value)}٪`);
const campaignTypes: Record<CampaignPerformance['campaignType'], string> = {
  SALES: 'پیشنهاد فروش',
  MARKETING: 'کمپین بازاریابی',
  FESTIVAL: 'جشنواره',
  LEGACY: 'کمپین قدیمی',
  TRACKING_ONLY: 'شناسهٔ ردیابی',
};
const coverageMessages: Record<CampaignPerformance['spendCoverage'], string> = {
  MATCHED:
    'برای ترکیب‌های دارای خرید قطعی هزینه ثبت شده است. هزینه‌ها بر پایهٔ ثبت‌های دستی‌اند و ممکن است بخشی از هزینهٔ واقعی را پوشش دهند.',
  NO_COST: 'برای کانال‌ها و منابع این کمپین در بازهٔ انتخاب‌شده هزینه‌ای ثبت نشده است.',
  NON_POSITIVE_COST: 'مجموع هزینهٔ ثبت‌شده پس از اصلاحیه‌ها مثبت نیست.',
  NO_CONFIRMED_ORDERS: 'برای محاسبهٔ بازده در این بازه خرید قطعی منتسب لازم است.',
  INCOMPLETE_COST:
    'برای بعضی از ترکیب‌های منبع و کانالِ دارای خرید قطعی، هزینه‌ای در این بازه ثبت نشده است.',
};

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

function ReportPages({
  page,
  hasMore,
  href,
  label,
}: {
  page: number;
  hasMore: boolean;
  href: (page: number) => string;
  label: string;
}) {
  if (page === 1 && !hasMore) return null;
  return (
    <nav aria-label={label} className="mt-4 flex flex-wrap items-center gap-2">
      {page > 1 && (
        <ButtonLink size="sm" variant="outline" href={href(page - 1)}>
          قبلی
        </ButtonLink>
      )}
      <span>صفحهٔ {integer(page)}</span>
      {hasMore && page < 10_000 && (
        <ButtonLink size="sm" variant="outline" href={href(page + 1)}>
          بعدی
        </ButtonLink>
      )}
    </nav>
  );
}

export function GrowthCampaignPerformanceView({
  report,
  status,
  from,
  to,
  path,
  canReadOrders,
  canReadSettings,
}: {
  report: CampaignPerformance | null;
  status: number;
  from: string;
  to: string;
  path: string;
  canReadOrders: boolean;
  canReadSettings: boolean;
}) {
  const totals = report?.totals;
  const budget = report?.budget;
  const pageHref = (section: 'campaign-history' | 'campaign-content', target: number) => {
    const query = new URLSearchParams({ from, to });
    const history = section === 'campaign-history' ? target : (report?.page ?? 1);
    const content = section === 'campaign-content' ? target : (report?.contentPage ?? 1);
    if (history > 1) query.set('page', String(history));
    if (content > 1) query.set('contentPage', String(content));
    return `${path}?${query}#${section}`;
  };
  const growthQuery = new URLSearchParams({
    from,
    to,
    ...(report ? { campaignId: report.campaignId } : {}),
  });
  const growthHref = `/growth?${growthQuery}`;
  const managedId = report?.managedCampaignId;
  const operationsHref =
    managedId && report?.campaignType !== 'MARKETING' && canReadSettings && canReadOrders
      ? `/campaigns?${new URLSearchParams({ id: managedId, step: 'operations' })}`
      : null;
  const offer = report?.offer;
  const discountLimit = budget ? budget.budgetToman - (budget.plannedChannelCostToman ?? 0) : 0;
  const committedDiscount = budget
    ? budget.lifetimeCommittedDiscountToman + (budget.lifetimeCommittedReferralRewardToman ?? 0)
    : 0;
  const budgetSignal = offer && discountCommitmentSignal(discountLimit, committedDiscount);
  const offerCard = report && offer && (
    <Card
      title="فروش مشمول پیشنهاد"
      description="مبنای این بخش قانون تخفیف ثبت‌شده روی سفارش است. یک سفارش ممکن است هم‌زمان از لینک کمپین دیگری آمده باشد."
    >
      <Figures
        items={[
          ['سفارش ثبت‌شده', integer(offer.submittedOrders)],
          ['خرید تأییدشده', integer(offer.confirmedOrders)],
          ['نرخ تکمیل پرداخت سفارش', percentage(offer.conversionPercent)],
          ['وصول قطعی', money(offer.collectedToman)],
          ['بازپرداخت قطعی', money(offer.refundedToman)],
          ['وصول خالص', money(offer.netCollectedToman)],
          ['تخفیف کالای پیشنهاد در خرید قطعی', money(report.merchandiseDiscountToman)],
          ['تخفیف ارسال پیشنهاد در خرید قطعی', money(report.shippingDiscountToman)],
        ]}
      />
    </Card>
  );

  return (
    <main className="admin-container space-y-5 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">عملکرد کمپین</h1>
          {report && (
            <p className="mt-1">
              {report.campaign} · {campaignTypes[report.campaignType]} ·{' '}
              <bdi>{report.campaignId}</bdi>
            </p>
          )}
        </div>
        <ButtonLink href={growthHref} variant="outline">
          داشبورد رشد
        </ButtonLink>
      </header>
      <Card title="بازهٔ گزارش" description="روزها به وقت تهران محاسبه می‌شوند. حداکثر ۹۲ روز.">
        <CampaignReportPeriod key={`${from}/${to}`} path={path} from={from} to={to} />
      </Card>
      {report && totals ? (
        <>
          {report.campaignType === 'SALES' && offerCard}
          <Card
            title="فروش منتسب و هزینهٔ رسانه"
            action={
              <ButtonLink size="sm" variant="outline" href={`${growthHref}#cost-history`}>
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
                ['نرخ تکمیل پرداخت سفارش', percentage(totals.conversionPercent)],
                ['مشتری با نخستین خرید قطعی', formatAdminInteger(report.newCustomers)],
                ['وصول قطعی', money(totals.collectedToman)],
                ['بازپرداخت قطعی', money(totals.refundedToman)],
                ['وصول خالص', money(totals.netCollectedToman)],
                ['هزینهٔ ثبت‌شدهٔ رسانه', money(totals.recordedSpendToman)],
                ['اعتبار مصرف‌شده در خرید منتسب', money(report.consumedCreditToman)],
                ['هزینهٔ جذب مشتری (CAC)', money(report.cacToman)],
                [
                  'بازده هزینهٔ رسانه (ROAS)',
                  report.roas === null ? unknown : `${ratio.format(report.roas)} برابر`,
                ],
              ]}
            />
            <ul className="mt-4 space-y-2 text-sm text-[var(--admin-color-muted)]">
              <li>
                سفارش‌های این بخش از انتساب ذخیره‌شدهٔ بازاریابی می‌آیند. خرید و بازپرداخت در روز
                تأیید خودشان شمرده می‌شوند. نرخ تکمیل پرداخت سهم سفارش‌های ثبت‌شده در بازه است که تا
                انتهای آن پرداخت شده‌اند.
              </li>
              <li>
                CAC برابر هزینهٔ ثبت‌شدهٔ رسانه تقسیم بر تعداد مشتریانی است که نخستین خرید قطعی
                آن‌ها به این کمپین منتسب شده است. ROAS برابر وصول پس از کسر بازپرداخت تقسیم بر همان
                هزینه است.
              </li>
              <li>{coverageMessages[report.spendCoverage]}</li>
              {report.spendCoverage === 'MATCHED' && report.newCustomers === 0 && (
                <li>
                  در این بازه نخستین خرید قطعی منتسب ثبت نشده است. هزینهٔ جذب قابل محاسبه نیست.
                </li>
              )}
              <li>اعتبار مصرف‌شده از Snapshot خرید قطعی و پیش از برگشت اعتبار خوانده می‌شود.</li>
            </ul>
          </Card>
          {report.campaignType !== 'SALES' && offerCard}
          {offer && (
            <Card
              title="سهمیهٔ فعلی پیشنهاد"
              description="فروش دستی بر ماندهٔ سهمیه اثر دارد. شاخص‌های سفارش و وصول فقط از فروش سایت محاسبه می‌شوند."
              action={
                operationsHref && (
                  <ButtonLink href={`${operationsHref}#campaign-quota`} variant="outline" size="sm">
                    جزئیات سهمیه
                  </ButtonLink>
                )
              }
            >
              {offer.quota.products ? (
                <Figures
                  items={[
                    ['سقف سهمیه', integer(offer.quota.limit)],
                    ['فروش قطعی سایت', integer(offer.quota.siteSold)],
                    ['فروش دستی خارج از سایت', integer(offer.quota.manualSold)],
                    ['رزرو فعال', integer(offer.quota.reserved)],
                    ['ماندهٔ سهمیه', integer(offer.quota.remaining)],
                  ]}
                />
              ) : (
                <p className="text-sm">برای این پیشنهاد سهمیه‌ای تعریف نشده است.</p>
              )}
            </Card>
          )}
          <Card
            title="انحراف از بودجه"
            description={`ثبت‌های هزینه و تعهدهای کل کمپین تا زمان گزارش ${formatAdminDateTime(report.generatedAt)}`}
          >
            {budget ? (
              <Figures
                items={[
                  ['سقف کل بودجه', money(budget.budgetToman)],
                  ['هزینهٔ برنامه‌ریزی‌شدهٔ رسانه', money(budget.plannedChannelCostToman)],
                  ['هزینهٔ ثبت‌شدهٔ رسانه', money(budget.lifetimeMediaSpendToman)],
                  ['اختلاف ثبت رسانه با برنامه', money(budget.mediaVarianceToman)],
                  ['مجموع تخفیف تعهدشده', money(budget.lifetimeCommittedDiscountToman)],
                  ...(offer
                    ? [['ماندهٔ سقف تخفیف', money(budget.remainingDiscountToman)] as const]
                    : []),
                  ...('lifetimeCommittedReferralRewardToman' in budget &&
                  typeof budget.lifetimeCommittedReferralRewardToman === 'number'
                    ? [
                        [
                          'پاداش معرف منظورشده در بودجه',
                          money(budget.lifetimeCommittedReferralRewardToman),
                        ] as const,
                      ]
                    : []),
                  [
                    'سهم سفارش‌های پرداخت‌نشده از تعهد تخفیف',
                    money(budget.unpaidDiscountCommitmentToman),
                  ],
                  [
                    'ماندهٔ کل بر اساس ثبت‌ها و تعهدها',
                    money(
                      budget.budgetVarianceToman === null ? null : 0 - budget.budgetVarianceToman,
                    ),
                  ],
                ]}
              />
            ) : (
              <p className="text-sm">برای این شناسهٔ ردیابی، بودجهٔ کمپین تعریف نشده است.</p>
            )}
            {budget && (
              <p className="mt-3 text-sm text-[var(--admin-color-muted)]">
                ماندهٔ منفی یعنی هزینهٔ ثبت‌شده و تعهد تخفیف و پاداش معرف از سقف گذشته‌اند. سفارش
                پرداخت‌نشده بخشی از مجموع تعهد است.
              </p>
            )}
            {budgetSignal && (
              <Alert
                className="mt-3"
                tone="warning"
                title={
                  budgetSignal.exhausted
                    ? 'سقف تخفیف درگیر شده است'
                    : 'تعهدها به سقف تخفیف نزدیک‌اند'
                }
              >
                <p>
                  {money(committedDiscount)} از {money(discountLimit)} ·{' '}
                  {ratio.format(budgetSignal.percent)}٪
                </p>
                <p>
                  آستانهٔ بررسی {integer(discountCommitmentThreshold)}٪ است. مبلغ درگیر از تخفیف
                  تعهدشده و پاداش معرف ثبت‌شده در Quoteهای واجد شرایط به دست می‌آید.
                </p>
                {operationsHref && (
                  <Link className="underline" href={`${operationsHref}#campaign-budget`}>
                    بررسی بودجه در مرکز عملیات
                  </Link>
                )}
              </Alert>
            )}
          </Card>
          <Card
            title="عملکرد منبع و کانال"
            description="ترکیب‌های منبع، کانال و برچسب کمپین بر اساس خرید تأییدشده مرتب شده‌اند."
          >
            {report.channels.length > 0 ? (
              <TableScrollRegion label="جدول عملکرد منبع و کانال">
                <table className="w-full min-w-[37rem] text-sm">
                  <thead>
                    <tr>
                      {[
                        'منبع و کانال',
                        'برچسب کمپین',
                        'خرید تأییدشده',
                        'نرخ تکمیل پرداخت سفارش',
                        'وصول خالص',
                        'هزینهٔ ثبت‌شده',
                      ].map((label) => (
                        <th key={label} scope="col" className={cell}>
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.channels.map((row) => {
                      const query = new URLSearchParams(growthQuery);
                      if (row.source) query.set('source', row.source);
                      if (row.medium) query.set('medium', row.medium);
                      return (
                        <tr key={JSON.stringify([row.source, row.medium, row.campaign])}>
                          <th scope="row" className={cell}>
                            <Link className="underline" href={`/growth?${query}#growth-groups`}>
                              <bdi>
                                {[row.source, row.medium].filter(Boolean).join(' / ') || 'ثبت نشده'}
                              </bdi>
                            </Link>
                          </th>
                          <td className={cell}>
                            <bdi>{row.campaign ?? '—'}</bdi>
                          </td>
                          <td className={cell}>{integer(row.confirmedOrders)}</td>
                          <td className={cell}>{percentage(row.conversionPercent)}</td>
                          <td className={cell}>{money(row.netCollectedToman)}</td>
                          <td className={cell}>{money(row.recordedSpendToman)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </TableScrollRegion>
            ) : (
              <p className="text-sm">در این بازه برای این کمپین دادهٔ کانال ثبت نشده است.</p>
            )}
            {report.channelCount > report.channels.length && (
              <Link
                className="mt-3 inline-block text-sm underline"
                href={`${growthHref}#growth-groups`}
              >
                مشاهدهٔ همهٔ {integer(report.channelCount)} ترکیب
              </Link>
            )}
          </Card>
          <Card
            id="campaign-content"
            className="scroll-mt-24"
            title="عملکرد برچسب‌های لینک ردیابی"
            description="سفارش‌ها با محتوای ذخیره‌شدهٔ لینک (utm_content) و به تفکیک منبع و کانال گروه‌بندی می‌شوند."
          >
            {report.trackingContents.length > 0 ? (
              <TableScrollRegion label="جدول عملکرد برچسب‌های لینک ردیابی">
                <table className="w-full min-w-[38rem] text-sm">
                  <thead>
                    <tr>
                      {[
                        'محتوای لینک',
                        'منبع و کانال',
                        'سفارش ثبت‌شده',
                        'خرید تأییدشده',
                        'وصول خالص',
                      ].map((label) => (
                        <th key={label} scope="col" className={cell}>
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.trackingContents.map((row) => (
                      <tr key={JSON.stringify([row.content, row.source, row.medium])}>
                        <th scope="row" className={cell}>
                          <bdi>{row.content}</bdi>
                        </th>
                        <td className={cell}>
                          <bdi>
                            {row.source} / {row.medium}
                          </bdi>
                        </td>
                        <td className={cell}>{integer(row.submittedOrders)}</td>
                        <td className={cell}>{integer(row.confirmedOrders)}</td>
                        <td className={cell}>{money(row.netCollectedToman)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableScrollRegion>
            ) : (
              <p className="text-sm">در این صفحه و بازه، سفارشی با محتوای لینک ثبت نشده است.</p>
            )}
            <ReportPages
              page={report.contentPage}
              hasMore={report.hasMoreTrackingContents}
              href={(page) => pageHref('campaign-content', page)}
              label="صفحات عملکرد لینک ردیابی"
            />
          </Card>
          <Card id="campaign-history" className="scroll-mt-24" title="تاریخچهٔ انتساب و لغو">
            {report.history.length ? (
              <TableScrollRegion label="جدول تاریخچهٔ انتساب و لغو">
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
              </TableScrollRegion>
            ) : (
              <p className="text-sm">در این صفحه رویدادی برای بازهٔ انتخاب‌شده ثبت نشده است.</p>
            )}
            <ReportPages
              page={report.page}
              hasMore={report.hasMoreHistory}
              href={(page) => pageHref('campaign-history', page)}
              label="صفحات تاریخچهٔ کمپین"
            />
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
