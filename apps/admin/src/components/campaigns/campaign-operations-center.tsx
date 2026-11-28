import type { components, paths } from '@hamidian/contracts';
import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TableScrollRegion } from '@/components/ui/data-table';
import { Select } from '@/components/ui/select';
import { campaignMessage } from '@/lib/campaigns/campaign-api-errors';
import {
  discountCommitmentSignal,
  discountCommitmentThreshold,
  isQuotaNearEnd,
  quotaRemainingThreshold,
} from '@/lib/growth/managerial-insights';
import {
  campaignOperationsOrderLabels,
  campaignOrderLabels,
  campaignStatusLabels,
  type CampaignDetail,
} from '@/lib/campaigns/campaign-model';
import {
  formatAdminDateTime,
  formatAdminInteger,
  formatAdminToman,
} from '@/lib/presentation/formatters';
import { CampaignEmergencyPause } from './campaign-emergency-pause';

type Operations = components['schemas']['CampaignOperationsCenterDto'];
type OrderFilter = NonNullable<
  paths['/api/v1/campaigns/{id}/operations']['get']['parameters']['query']
>['orderState'];
type QuotaProduct = components['schemas']['CampaignQuotaOperationDto'];
type OperationCampaign = Pick<
  CampaignDetail,
  | 'id'
  | 'revision'
  | 'kind'
  | 'managementPurpose'
  | 'status'
  | 'name'
  | 'trackingId'
  | 'archivedAt'
  | 'startsAt'
  | 'endsAt'
  | 'budget'
  | 'history'
>;

const integer = formatAdminInteger;
const money = formatAdminToman;
const storefrontOrigin = (
  process.env.NEXT_PUBLIC_STOREFRONT_URL ?? 'https://hamidian.shop'
).replace(/\/+$/, '');

const publicationLabels: Record<Operations['publication'], string> = {
  NO_LANDING: 'صفحهٔ کمپین تعریف نشده',
  INACTIVE: 'صفحهٔ کمپین در حال نمایش نیست',
  EMPTY: 'کمپین فعال است و مجموعه محصول قابل خرید ندارد',
  LIVE: 'صفحهٔ کمپین و محصولات قابل خرید در دسترس‌اند',
  UNKNOWN: 'بررسی مجموعه ممکن نشد',
  HISTORICAL: 'صفحهٔ دورهٔ پایان‌یافته در دسترس است',
};

const productStatusLabels: Record<QuotaProduct['productStatus'], string> = {
  ACTIVE: 'فعال',
  DRAFT: 'پیش‌نویس',
  ARCHIVED: 'بایگانی‌شده',
  DELETED: 'حذف‌شده',
};

function timeRemaining(until: string, checkedAt: string, elapsed: string) {
  const remaining = Math.ceil((Date.parse(until) - Date.parse(checkedAt)) / 60_000);
  if (remaining <= 0) return elapsed;
  const days = Math.floor(remaining / 1440);
  const hours = Math.floor((remaining % 1440) / 60);
  const minutes = remaining % 60;
  return [
    days && `${integer(days)} روز`,
    hours && `${integer(hours)} ساعت`,
    minutes && `${integer(minutes)} دقیقه`,
  ]
    .filter(Boolean)
    .join(' و ');
}

function QuotaProductName({ row, canEditCatalog }: { row: QuotaProduct; canEditCatalog: boolean }) {
  const href =
    row.productStatus === 'DELETED'
      ? null
      : canEditCatalog
        ? `/products/${row.productId}/edit`
        : row.productStatus === 'ACTIVE'
          ? `${storefrontOrigin}/products/${encodeURIComponent(row.slug)}`
          : null;
  return (
    <div className="flex min-w-36 items-start gap-2">
      {row.imageUrl && (
        <Image
          src={row.imageUrl}
          alt=""
          width={40}
          height={40}
          unoptimized
          className="size-10 rounded object-cover"
        />
      )}
      <div>
        {href ? (
          <Link
            href={href}
            className="underline"
            target={canEditCatalog ? undefined : '_blank'}
            rel={canEditCatalog ? undefined : 'noreferrer'}
          >
            {row.name}
          </Link>
        ) : (
          row.name
        )}
        {(row.variants.length > 1 ||
          row.variants.some(({ priceToman }) => priceToman !== row.defaultPriceToman)) && (
          <details className="mt-1 text-xs font-normal">
            <summary className="cursor-pointer">قیمت واریانت‌ها</summary>
            <ul className="mt-1 space-y-1">
              {row.variants.map((variant) => (
                <li key={variant.sku}>
                  <bdi>{variant.name ?? variant.sku}</bdi>{' '}
                  {variant.priceToman === null ? 'قیمت ثبت نشده' : money(variant.priceToman)}
                </li>
              ))}
            </ul>
            {row.hasMoreVariants && <p className="mt-1">فهرست کامل در صفحهٔ محصول</p>}
          </details>
        )}
      </div>
    </div>
  );
}

function Metrics({ rows }: { rows: readonly (readonly [string, ReactNode])[] }) {
  return (
    <dl className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {rows.map(([label, value]) => (
        <div
          key={label}
          className="rounded-lg border border-[var(--admin-color-border)] bg-[var(--admin-color-surface-subtle)] p-3"
        >
          <dt className="text-xs text-[var(--admin-color-muted)]">{label}</dt>
          <dd className="mt-1 break-words font-semibold">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function PageLinks({
  page,
  hasMore,
  url,
  label,
}: {
  page: number;
  hasMore: boolean;
  url: (page: number) => string;
  label: string;
}) {
  if (page === 1 && !hasMore) return null;
  return (
    <nav aria-label={label} className="mt-4 flex flex-wrap items-center gap-2">
      {page > 1 && (
        <ButtonLink size="sm" variant="outline" href={url(page - 1)}>
          صفحهٔ قبل
        </ButtonLink>
      )}
      <span className="text-sm">صفحهٔ {integer(page)}</span>
      {hasMore && page < 1000 && (
        <ButtonLink size="sm" variant="outline" href={url(page + 1)}>
          صفحهٔ بعد
        </ButtonLink>
      )}
    </nav>
  );
}

export function CampaignOperationsCenter({
  campaign,
  data,
  listQuery,
  orderState,
  orderSort,
  canWrite,
  canEditCatalog,
  canReadAudit,
}: {
  campaign: OperationCampaign;
  data: Operations;
  listQuery?: Readonly<Record<string, string>>;
  orderState?: OrderFilter;
  orderSort: 'newest' | 'oldest';
  canWrite: boolean;
  canEditCatalog: boolean;
  canReadAudit: boolean;
}) {
  const { orders, quota, finance, festival } = data;
  const reportPath =
    campaign.kind === 'FESTIVAL'
      ? `/growth/festivals/${encodeURIComponent(campaign.id)}`
      : `/growth/campaigns/${encodeURIComponent(campaign.trackingId)}`;
  const campaignPath = (step: string) =>
    `/campaigns?${new URLSearchParams({ id: campaign.id, step, ...listQuery })}`;
  const reviewPath = campaignPath('review');
  const salesPath = campaignPath('promotion');
  const landingPath = campaignPath('landing');
  const operationPath = (orderPage: number, quotaPage: number, filter = orderState) => {
    const query = new URLSearchParams({ id: campaign.id, step: 'operations', ...listQuery });
    if (orderPage > 1) query.set('orderPage', String(orderPage));
    if (quotaPage > 1) query.set('quotaPage', String(quotaPage));
    if (filter) query.set('orderState', filter);
    if (orderSort === 'oldest') query.set('orderSort', orderSort);
    return `/campaigns?${query}`;
  };
  const orderActions = [
    ['رسید در انتظار بررسی', orders.awaitingReceipt, 'RECEIPT_REVIEW'],
    ['رسید ردشده', orders.rejectedReceipt, 'RECEIPT_REJECTED'],
    ['پرداخت ناموفق', orders.paymentFailed, 'PAYMENT_FAILED'],
    ['نیازمند تطبیق پرداخت', orders.reconciliation, 'RECONCILIATION'],
    ['رزرو گذشته از مهلت', orders.overdueReservations, 'OVERDUE_RESERVATION'],
  ] as const;
  const stockShortfall =
    festival?.stockShortfallProducts ??
    data.quotaItems.filter(({ stockShortfall }) => stockShortfall > 0).length;
  const missingPrice =
    festival?.missingDefaultPriceProducts ??
    data.quotaItems.filter(
      ({ productStatus, defaultPriceToman }) =>
        productStatus === 'ACTIVE' && (defaultPriceToman ?? 0) <= 0,
    ).length;
  const needsPublicationReview =
    Boolean(festival?.publicationError) ||
    (!campaign.archivedAt &&
      (data.publication === 'EMPTY' ||
        data.publication === 'UNKNOWN' ||
        (festival !== null && data.publication === 'NO_LANDING')));
  const budgetBlockers = finance ? campaign.budget.blockers : [];
  const budgetWarnings = finance ? campaign.budget.warnings : [];
  const active =
    !campaign.archivedAt && (campaign.status === 'ACTIVE' || campaign.status === 'SCHEDULED');
  const nearQuotaIds = new Set(
    active ? data.quotaItems.filter(isQuotaNearEnd).map(({ productId }) => productId) : [],
  );
  const budgetLimit = campaign.budget.discountBudgetToman;
  const committedReward = campaign.budget.committedReferralRewardToman ?? 0;
  const committedBudget = campaign.budget.committedDiscountToman + committedReward;
  const budgetSignal =
    finance && active ? discountCommitmentSignal(budgetLimit, committedBudget) : null;
  const needsAttention =
    orderActions.some(([, count]) => count > 0) ||
    stockShortfall > 0 ||
    missingPrice > 0 ||
    nearQuotaIds.size > 0 ||
    budgetSignal !== null ||
    needsPublicationReview ||
    budgetBlockers.length > 0 ||
    budgetWarnings.length > 0;
  const cell = 'px-3 py-2 text-start align-top';
  const publicLanding =
    data.publication === 'LIVE' ||
    data.publication === 'EMPTY' ||
    data.publication === 'HISTORICAL';
  const committedPercent = budgetLimit > 0 ? Math.round((100 * committedBudget) / budgetLimit) : 0;
  const timing =
    campaign.status === 'SCHEDULED'
      ? ([
          'تا شروع',
          timeRemaining(campaign.startsAt, data.checkedAt, 'در انتظار فعال‌سازی'),
        ] as const)
      : ([
          'تا پایان',
          timeRemaining(campaign.endsAt, data.checkedAt, 'زمان پایان گذشته است'),
        ] as const);

  return (
    <div className="space-y-5">
      <Card
        title={campaign.name}
        description={`آخرین بررسی ${formatAdminDateTime(data.checkedAt)}`}
        action={
          <Badge tone={campaign.status === 'ACTIVE' ? 'success' : 'neutral'}>
            {campaign.archivedAt ? 'بایگانی‌شده' : campaignStatusLabels[campaign.status]}
          </Badge>
        }
      >
        <Metrics
          rows={[
            ['شروع', formatAdminDateTime(campaign.startsAt)],
            ['پایان', formatAdminDateTime(campaign.endsAt)],
            ...(active && !campaign.archivedAt ? [timing] : []),
            [
              'قانون فروش',
              <Link key="rule" href={salesPath} className="underline">
                {data.salesRuleConfigured ? 'قانون تخفیف ثبت شده' : 'قانون تخفیف ثبت نشده'}
              </Link>,
            ],
            [
              'سهمیه',
              <Link key="quota" href="#campaign-quota" className="underline">
                {quota.products > 0
                  ? `${integer(quota.remaining)} واحد باقی‌مانده`
                  : 'سهمیه تعریف نشده'}
              </Link>,
            ],
            ...(finance
              ? [
                  [
                    'ماندهٔ بودجهٔ تخفیف',
                    <Link key="budget" href="#campaign-budget" className="underline">
                      {money(campaign.budget.remainingDiscountToman)}
                    </Link>,
                  ] as const,
                ]
              : []),
          ]}
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {canWrite && active && (
            <CampaignEmergencyPause key={campaign.revision} campaign={campaign} />
          )}
          <ButtonLink href={reviewPath} variant="outline" size="sm">
            چرخه و تاریخچهٔ کمپین
          </ButtonLink>
          {canReadAudit && (
            <ButtonLink href="/audit" variant="outline" size="sm">
              گزارش عملیات مدیران
            </ButtonLink>
          )}
          {data.landingSlug && !campaign.archivedAt && (!festival || publicLanding) && (
            <ButtonLink
              href={`${storefrontOrigin}/campaigns/${encodeURIComponent(data.landingSlug)}`}
              target="_blank"
              rel="noreferrer"
              variant="outline"
              size="sm"
            >
              مشاهدهٔ صفحه در فروشگاه
            </ButtonLink>
          )}
        </div>
      </Card>

      <Card
        title="سلامت عملیاتی"
        action={
          <Badge tone={needsAttention ? 'warning' : 'neutral'}>
            {needsAttention ? 'نیازمند رسیدگی' : 'بدون هشدار ثبت‌شده'}
          </Badge>
        }
      >
        {needsAttention && (
          <ul className="space-y-2 text-sm">
            {orderActions.map(([label, count, filter]) =>
              count > 0 ? (
                <li key={filter}>
                  <Link
                    className="underline"
                    href={`${operationPath(1, data.quotaPage, filter)}#campaign-orders`}
                  >
                    {label} {integer(count)}
                  </Link>
                </li>
              ) : null,
            )}
            {stockShortfall > 0 && (
              <li>
                <Link className="underline" href="#campaign-quota">
                  محصولات با کسری موجودی نسبت به سهمیه {integer(stockShortfall)}
                </Link>
                {!festival && ' در صفحهٔ فعلی سهمیه'}
              </li>
            )}
            {missingPrice > 0 && (
              <li>
                <Link className="underline" href="#campaign-quota">
                  محصولات فعال سهمیه‌دار بدون قیمت پیش‌فرض معتبر {integer(missingPrice)}
                </Link>
                {!festival && ' در صفحهٔ فعلی سهمیه'}
              </li>
            )}
            {nearQuotaIds.size > 0 && (
              <li>
                <Link className="underline" href="#campaign-quota">
                  {integer(nearQuotaIds.size)} محصول نزدیک اتمام سهمیه در همین صفحه
                </Link>
                <span className="ms-2 text-xs text-[var(--admin-color-muted)]">
                  مانده پس از فروش سایت، فروش دستی و رزرو، حداکثر {integer(quotaRemainingThreshold)}
                  ٪ سقف محصول است.
                </span>
              </li>
            )}
            {budgetSignal && (
              <li>
                <Link className="underline" href="#campaign-budget">
                  {budgetSignal.exhausted
                    ? 'سقف تخفیف درگیر شده است'
                    : 'تعهدها به سقف تخفیف نزدیک‌اند'}
                </Link>
                <span className="ms-2 text-xs text-[var(--admin-color-muted)]">
                  {money(committedBudget)} از {money(budgetLimit)} · آستانهٔ بررسی{' '}
                  {integer(discountCommitmentThreshold)}٪
                </span>
              </li>
            )}
            {needsPublicationReview && (
              <li>
                <Link className="underline" href="#campaign-publication">
                  نیاز به بررسی انتشار
                </Link>
              </li>
            )}
            {(budgetBlockers.length > 0 || budgetWarnings.length > 0) && (
              <li>
                <Link className="underline" href="#campaign-budget">
                  بررسی موانع و هشدارهای قانون و بودجه
                </Link>
              </li>
            )}
          </ul>
        )}
        {campaign.history[0] && (
          <p className="mt-3 text-sm">
            <Link className="underline" href={reviewPath}>
              تاریخچهٔ عملیات
            </Link>{' '}
            <span>
              آخرین تغییر نسخهٔ {integer(campaign.history[0].version)} در{' '}
              {formatAdminDateTime(campaign.history[0].recordedAt)}
            </span>
          </p>
        )}
        <p className="mt-3 text-xs leading-6 text-[var(--admin-color-muted)]">
          وضعیت بر پایهٔ سفارش‌های مرتبط، تنظیمات انتشار و داده‌های سهمیه است. خطاهای Checkout پیش
          از ثبت سفارش در اینجا شمارش نمی‌شوند.
        </p>
      </Card>

      <Card
        id="campaign-publication"
        className="scroll-mt-24"
        title={festival ? 'وضعیت انتشار جشنواره' : 'وضعیت انتشار'}
      >
        {festival ? (
          <Metrics
            rows={[
              [
                'آخرین نسخهٔ منتشرشده',
                festival.version === null ? 'ثبت نشده' : integer(festival.version),
              ],
              ['لندینگ', campaign.archivedAt ? 'بایگانی‌شده' : publicationLabels[data.publication]],
              ['آیتم منو', festival.navigation ? 'در حال نمایش' : 'نمایش داده نمی‌شود'],
              ['نوار اعلان', festival.announcement ? 'در حال نمایش' : 'نمایش داده نمی‌شود'],
            ]}
          />
        ) : (
          <p className="text-sm">
            {campaign.managementPurpose === 'SALES'
              ? 'در صورت احراز شرایط، قانون این پیشنهاد در سبد خرید اعمال می‌شود.'
              : campaign.archivedAt
                ? 'صفحهٔ این دوره بایگانی شده است.'
                : campaign.kind === 'MARKETING' && data.publication === 'NO_LANDING'
                  ? 'کمپین بازاریابی از پیوند مقصد تعیین‌شده استفاده می‌کند.'
                  : publicationLabels[data.publication]}
          </p>
        )}
        {needsPublicationReview && (
          <Alert tone="warning" className="mt-3">
            <p>
              {festival?.publicationError
                ? campaignMessage(
                    festival.publicationError,
                    'انتشار خودکار متوقف شد. دلیل را در تاریخچهٔ نسخه‌ها بررسی کنید.',
                  )
                : publicationLabels[data.publication]}
            </p>
            <Link href={landingPath} className="underline">
              باز کردن تنظیمات لندینگ
            </Link>
          </Alert>
        )}
      </Card>

      <Card id="campaign-orders" className="scroll-mt-24" title="سفارش‌ها و پرداخت‌ها">
        <Metrics
          rows={[
            ['سفارش ثبت‌شده', integer(orders.registered)],
            ['خرید تأییدشده', integer(orders.confirmed)],
            ['در انتظار پرداخت', integer(orders.pending)],
            ['رسید در انتظار بررسی', integer(orders.awaitingReceipt)],
            ['رسید ردشده', integer(orders.rejectedReceipt)],
            ['لغوشده', integer(orders.cancelled)],
            ['نیازمند تطبیق', integer(orders.reconciliation)],
            ['پرداخت ناموفق', integer(orders.paymentFailed)],
            ['مهلت رزرو گذشته', integer(orders.overdueReservations)],
            ['منقضی‌شده', integer(orders.expired)],
          ]}
        />
        <p className="mt-3 text-xs leading-6 text-[var(--admin-color-muted)]">
          وضعیت خرید و پرداخت بر اساس سفارش‌های ثبت‌شدهٔ مرتبط با کمپین است. مهلت رزرو و تطبیق
          می‌توانند هم‌زمان با وضعیت‌های دیگر ثبت شوند.
        </p>
        <form
          action="/campaigns#campaign-orders"
          method="get"
          className="mt-4 flex flex-wrap items-end gap-2"
        >
          <input type="hidden" name="id" value={campaign.id} />
          <input type="hidden" name="step" value="operations" />
          {Object.entries(listQuery ?? {}).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          {data.quotaPage > 1 && <input type="hidden" name="quotaPage" value={data.quotaPage} />}
          <label className="grid gap-1 text-sm">
            وضعیت سفارش یا مهلت رزرو
            <Select
              name="orderState"
              defaultValue={orderState ?? ''}
              className="min-h-9 rounded-md border border-[var(--admin-color-border)] px-2"
              aria-label="وضعیت سفارش یا مهلت رزرو"
              options={[
                { value: '', label: 'همهٔ وضعیت‌ها' },
                ...Object.entries(campaignOperationsOrderLabels).map(([key, label]) => ({
                  value: key,
                  label,
                })),
              ]}
            />
          </label>
          <label className="grid gap-1 text-sm">
            ترتیب ثبت
            <Select
              name="orderSort"
              defaultValue={orderSort}
              className="min-h-9 rounded-md border border-[var(--admin-color-border)] px-2"
              aria-label="ترتیب ثبت"
              options={[
                { value: 'newest', label: 'جدیدترین' },
                { value: 'oldest', label: 'قدیمی‌ترین' },
              ]}
            />
          </label>
          <button
            type="submit"
            className="min-h-9 rounded-md border border-[var(--admin-color-border)] px-3 text-sm font-semibold"
          >
            اعمال فیلتر
          </button>
        </form>
        {data.orderItems.length ? (
          <TableScrollRegion label="جدول سفارش‌های کمپین" className="mt-3">
            <table className="w-full min-w-[34rem] text-sm">
              <thead>
                <tr>
                  <th scope="col" className={cell}>
                    شماره سفارش
                  </th>
                  <th scope="col" className={cell}>
                    زمان ثبت
                  </th>
                  <th scope="col" className={cell}>
                    وضعیت
                  </th>
                  <th scope="col" className={cell}>
                    ارتباط با کمپین
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--admin-color-border)]">
                {data.orderItems.map(({ id, number, createdAt, state, discountApplied }) => (
                  <tr key={id}>
                    <td className={cell}>
                      <Link href={`/orders?orderId=${id}`} className="underline">
                        <bdi>{number}</bdi>
                      </Link>
                    </td>
                    <td className={cell}>{formatAdminDateTime(createdAt)}</td>
                    <td className={cell}>{campaignOrderLabels[state]}</td>
                    <td className={cell}>{discountApplied ? 'تخفیف ثبت‌شده' : 'انتساب کمپین'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScrollRegion>
        ) : (
          <p role="status" className="mt-4 text-sm">
            سفارشی برای این فیلتر ثبت نشده است.
          </p>
        )}
        <PageLinks
          label="صفحات سفارش‌های کمپین"
          page={data.orderPage}
          hasMore={data.hasMoreOrders}
          url={(page) => `${operationPath(page, data.quotaPage)}#campaign-orders`}
        />
      </Card>

      <Card
        id="campaign-quota"
        className="scroll-mt-24"
        title="سهمیه و موجودی"
        description="فروش سایت مربوط به کالاهای سهمیه‌دار است. اصلاح فروش دستی در بخش قانون و کوپن انجام می‌شود."
      >
        <Metrics
          rows={[
            ['محصول سهمیه‌دار', integer(quota.products)],
            ['سقف سهمیه', integer(quota.limit)],
            ['فروش قطعی سایت', integer(quota.siteSold)],
            ['فروش دستی', integer(quota.manualSold)],
            ['رزرو فعال', integer(quota.reserved)],
            ['ماندهٔ سهمیه', integer(quota.remaining)],
          ]}
        />
        {data.quotaItems.length ? (
          <TableScrollRegion label="جدول سهمیهٔ کمپین" className="mt-3">
            <table className="w-full min-w-[44rem] text-sm">
              <thead>
                <tr>
                  {[
                    'محصول',
                    'وضعیت محصول',
                    'قیمت پیش‌فرض',
                    'سقف',
                    'فروش سایت',
                    'فروش دستی',
                    'رزرو',
                    'مانده',
                    'موجودی',
                    'وضعیت سهمیه',
                  ].map((label) => (
                    <th key={label} scope="col" className={cell}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--admin-color-border)]">
                {data.quotaItems.map((row) => (
                  <tr key={row.productId}>
                    <th scope="row" className={cell}>
                      <QuotaProductName row={row} canEditCatalog={canEditCatalog} />
                    </th>
                    <td className={cell}>{productStatusLabels[row.productStatus]}</td>
                    <td className={cell}>
                      {row.defaultPriceToman !== null && row.defaultPriceToman > 0 ? (
                        money(row.defaultPriceToman)
                      ) : row.productStatus === 'ACTIVE' ? (
                        <Badge tone="warning">قیمت معتبر ثبت نشده</Badge>
                      ) : (
                        'ثبت نشده'
                      )}
                    </td>
                    {[
                      row.limit,
                      row.siteSold,
                      row.manualSold,
                      row.reserved,
                      row.remaining,
                      row.sellableStock,
                    ].map((value, index) => (
                      <td key={index} className={cell}>
                        {integer(value)}
                      </td>
                    ))}
                    <td className={cell}>
                      <div className="flex flex-wrap gap-1">
                        {row.stockShortfall > 0 && (
                          <Badge tone="warning">{integer(row.stockShortfall)} کسری</Badge>
                        )}
                        {nearQuotaIds.has(row.productId) && (
                          <Badge tone="warning">نزدیک اتمام سهمیه</Badge>
                        )}
                        {row.remaining === 0 && <Badge tone="neutral">سهمیه تمام شده</Badge>}
                        {row.stockShortfall === 0 &&
                          row.remaining > 0 &&
                          !nearQuotaIds.has(row.productId) &&
                          'دارای مانده'}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScrollRegion>
        ) : (
          <p className="mt-4 text-sm">در این صفحه سهمیه‌ای برای نمایش وجود ندارد.</p>
        )}
        {canWrite && (
          <ButtonLink href={salesPath} variant="outline" size="sm" className="mt-3">
            مدیریت سهمیه و فروش دستی
          </ButtonLink>
        )}
        <PageLinks
          label="صفحات سهمیهٔ محصولات"
          page={data.quotaPage}
          hasMore={data.hasMoreQuotas}
          url={(page) => `${operationPath(data.orderPage, page)}#campaign-quota`}
        />
      </Card>

      {finance && (
        <Card
          id="campaign-budget"
          className="scroll-mt-24"
          title="هزینهٔ تخفیف و بودجه"
          action={
            <ButtonLink href={reportPath} variant="outline" size="sm">
              گزارش مالی و درآمد
            </ButtonLink>
          }
        >
          <Metrics
            rows={[
              ['تخفیف کالای خریدهای تأییدشده', money(finance.confirmedMerchandiseDiscountToman)],
              ['تخفیف ارسال خریدهای تأییدشده', money(finance.confirmedShippingDiscountToman)],
              ['سقف تخفیف کمپین', money(campaign.budget.discountBudgetToman)],
              ['کل تخفیف تعهدشده', money(campaign.budget.committedDiscountToman)],
              ...(committedReward > 0
                ? [['پاداش معرف منظورشده در بودجه', money(committedReward)] as const]
                : []),
              ['بودجهٔ تخفیف باقی‌مانده', money(campaign.budget.remainingDiscountToman)],
            ]}
          />
          {budgetLimit > 0 && (
            <label className="mt-3 grid gap-1 text-sm">
              <span>بودجهٔ درگیر {integer(committedPercent)}٪</span>
              <progress
                className="h-2 w-full accent-[var(--admin-color-info)]"
                max={budgetLimit}
                value={Math.min(committedBudget, budgetLimit)}
              />
            </label>
          )}
          <p className="mt-3 text-xs leading-6 text-[var(--admin-color-muted)]">
            تخفیف تعهدشده شامل تخفیف سفارش‌های تأییدشده و تعهد سفارش‌های باز است. پاداش معرف نیز از
            همان سقف کسر می‌شود.
          </p>
          {(budgetBlockers.length > 0 || budgetWarnings.length > 0) && (
            <Alert tone="warning" title="موانع و هشدارهای قانون فروش" className="mt-3">
              <ul>
                {Array.from(new Set([...budgetBlockers, ...budgetWarnings]), (reason) => (
                  <li key={reason}>
                    {campaignMessage(reason, 'تنظیمات قانون و بودجه را بررسی کنید.')}
                  </li>
                ))}
              </ul>
              <Link href={salesPath} className="underline">
                مشاهدهٔ قوانین فروش
              </Link>
            </Alert>
          )}
        </Card>
      )}
    </div>
  );
}
