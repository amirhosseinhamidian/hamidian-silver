import Link from 'next/link';
import { Card } from '@/components/ui/card';
import {
  confirmedPurchaseChange,
  materialPurchaseChangePercent,
  minimumPeriodPurchases,
} from '@/lib/growth/managerial-insights';
import {
  growthDashboardHref,
  type GrowthDashboard,
  type GrowthFilters,
} from '@/lib/growth/growth-report';
import {
  formatAdminDateTime,
  formatAdminInteger,
  toPersianDigits,
} from '@/lib/presentation/formatters';

const percent = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 });
const muted = 'text-xs leading-6 text-[var(--admin-color-muted)]';

export function GrowthManagerialInsights({
  report,
  comparison,
  filters,
}: {
  report: GrowthDashboard;
  comparison: GrowthDashboard | null;
  filters: GrowthFilters;
}) {
  const { leadingCampaign, leadingChannel, minimumChannelOrders } = report;
  const change = comparison ? confirmedPurchaseChange(report, comparison) : null;
  const groupHref = (selection: Pick<Partial<GrowthFilters>, 'campaignId' | 'medium'>) =>
    growthDashboardHref({ ...filters, ...selection, page: 1, costPage: 1 }, '#growth-groups');
  const comparisonHref = growthDashboardHref({ ...filters, compare: true }, '#growth-insights');

  return (
    <Card
      id="growth-insights"
      className="scroll-mt-24"
      title="تحلیل مدیریتی"
      description={`${toPersianDigits(report.period.from)} تا ${toPersianDigits(report.period.to)} به وقت تهران · زمان گزارش ${formatAdminDateTime(report.generatedAt)}`}
    >
      {leadingCampaign || leadingChannel || change ? (
        <ul className="divide-y divide-[var(--admin-color-border)] text-sm">
          {leadingCampaign && (
            <li className="space-y-1 py-3">
              <Link
                className="font-semibold underline"
                href={groupHref({ campaignId: leadingCampaign.campaignId })}
              >
                <bdi>{leadingCampaign.campaign}</bdi>، بیشترین خرید منتسب
              </Link>
              <p>{formatAdminInteger(leadingCampaign.confirmedOrders)} خرید تأییدشده در این برش</p>
              <p className={muted}>
                منبع، انتساب ذخیره‌شدهٔ سفارش و زمان تأیید پرداخت است. خریدها یک‌بار برای هر شناسهٔ
                کمپین شمرده شده‌اند.
              </p>
            </li>
          )}
          {leadingChannel && (
            <li className="space-y-1 py-3">
              <Link
                className="font-semibold underline"
                href={groupHref({ medium: leadingChannel.medium })}
              >
                <bdi>{leadingChannel.medium}</bdi>، بالاترین نرخ تکمیل پرداخت سفارش
              </Link>
              <p>
                {percent.format(
                  (100 * leadingChannel.confirmedSubmissions) / leadingChannel.submittedOrders,
                )}
                ٪ · پرداخت {formatAdminInteger(leadingChannel.confirmedSubmissions)} از{' '}
                {formatAdminInteger(leadingChannel.submittedOrders)} سفارش ثبت‌شده تا پایان بازه
              </p>
              <p className={muted}>
                منبع، ثبت و پرداخت سفارش‌های منتسب به کانال است. برای مقایسه هر کانال باید دست‌کم{' '}
                {formatAdminInteger(minimumChannelOrders)} سفارش داشته باشد.
              </p>
            </li>
          )}
          {change && (
            <li className="space-y-1 py-3">
              <Link className="font-semibold underline" href="#growth-comparison">
                {percent.format(Math.abs(change.percent))}٪ {change.percent > 0 ? 'افزایش' : 'کاهش'}{' '}
                خرید تأییدشده
              </Link>
              <p>
                {formatAdminInteger(change.currentPurchases)} خرید در بازهٔ فعلی در برابر{' '}
                {formatAdminInteger(change.previousPurchases)} خرید در بازهٔ قبلی هم‌اندازه
              </p>
              <p className={muted}>
                منبع، پرداخت‌های قطعی دو بازه با همین فیلترهاست. درصد تغییر نسبت به تعداد خرید بازهٔ
                قبلی محاسبه شده است.
              </p>
            </li>
          )}
        </ul>
      ) : (
        <p className="text-sm">برای فیلترهای فعلی سیگنال قابل مقایسه‌ای به دست نیامد.</p>
      )}
      <details className="mt-3 space-y-2 text-sm">
        <summary className="cursor-pointer underline">شرایط نمایش تحلیل</summary>
        <ul className={muted}>
          <li>رتبه فقط با دست‌کم دو گزینهٔ واجد شرایط و برتری بدون تساوی نمایش داده می‌شود.</li>
          <li>
            تغییر تعداد خرید فقط برای دو بازهٔ کامل با حداقل{' '}
            {formatAdminInteger(minimumPeriodPurchases)} خرید قطعی در هر بازه و تغییر دست‌کم{' '}
            {formatAdminInteger(materialPurchaseChangePercent)}٪ نمایش داده می‌شود.
          </li>
          <li>برای سنجش ریزش از نشست تا سفارش و نرخ خرید مجدد، دادهٔ پیوستهٔ کافی وجود ندارد.</li>
        </ul>
      </details>
      {!filters.compare && (
        <Link className="mt-3 inline-block text-sm underline" href={comparisonHref}>
          بررسی تغییر نسبت به بازهٔ قبلی
        </Link>
      )}
    </Card>
  );
}
