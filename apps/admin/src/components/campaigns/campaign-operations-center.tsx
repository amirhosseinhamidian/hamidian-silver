import type { components } from '@hamidian/contracts';
import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { campaignMessage } from '@/lib/campaigns/campaign-api-errors';
import { campaignStatusLabels, type CampaignDetail } from '@/lib/campaigns/campaign-model';
import {
  formatAdminDateTime,
  formatAdminInteger,
  formatAdminToman,
} from '@/lib/presentation/formatters';
import { CampaignEmergencyPause } from './campaign-emergency-pause';

type Operations = components['schemas']['CampaignOperationsCenterDto'];
type OrderState = components['schemas']['CampaignOrderOperationDto']['state'];
type QuotaProduct = components['schemas']['CampaignQuotaOperationDto'];
type OperationCampaign = Pick<
  CampaignDetail,
  | 'id'
  | 'revision'
  | 'kind'
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

export const campaignOrderLabels: Record<OrderState, string> = {
  PENDING: 'در انتظار پرداخت',
  CONFIRMED: 'خرید تأییدشده',
  RECEIPT_REVIEW: 'در انتظار بررسی رسید',
  RECEIPT_REJECTED: 'رسید ردشده',
  PAYMENT_FAILED: 'پرداخت ناموفق',
  RECONCILIATION: 'نیازمند تطبیق پرداخت',
  CANCELLED: 'لغوشده',
  EXPIRED: 'منقضی',
};

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

function timeRemaining(endsAt: string, checkedAt: string) {
  const remaining = Math.ceil((Date.parse(endsAt) - Date.parse(checkedAt)) / 60_000);
  if (remaining <= 0) return 'زمان پایان گذشته است';
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

function QuotaProductName({
  row,
  festival,
  canEditCatalog,
}: {
  row: QuotaProduct;
  festival: boolean;
  canEditCatalog: boolean;
}) {
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
      {festival && row.imageUrl && (
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
        {festival && row.variants.length > 1 && (
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
  orderState,
  orderSort,
  canWrite,
  canEditCatalog,
  canReadAudit,
}: {
  campaign: OperationCampaign;
  data: Operations;
  orderState?: OrderState;
  orderSort: 'newest' | 'oldest';
  canWrite: boolean;
  canEditCatalog: boolean;
  canReadAudit: boolean;
}) {
  const { orders, quota, finance, festival } = data;
  const reportPath = `/growth/campaigns/${encodeURIComponent(campaign.trackingId)}`;
  const reviewPath = `/campaigns?id=${campaign.id}&step=review`;
  const salesPath = `/campaigns?id=${campaign.id}&step=promotion`;
  const landingPath = `/campaigns?id=${campaign.id}&step=landing`;
  const operationPath = (orderPage: number, quotaPage: number, filter = orderState) => {
    const query = new URLSearchParams({ id: campaign.id, step: 'operations' });
    if (orderPage > 1) query.set('orderPage', String(orderPage));
    if (quotaPage > 1) query.set('quotaPage', String(quotaPage));
    if (filter) query.set('orderState', filter);
    if (orderSort === 'oldest') query.set('orderSort', orderSort);
    return `/campaigns?${query}`;
  };
  const observedIssues =
    orders.rejectedReceipt ||
    orders.paymentFailed ||
    orders.reconciliation ||
    orders.overdueReservations;
  const shortfall = data.quotaItems.some(({ stockShortfall }) => stockShortfall > 0);
  const cell = 'px-3 py-2 text-start align-top';
  const active = campaign.status === 'ACTIVE' || campaign.status === 'SCHEDULED';
  const publicLanding =
    data.publication === 'LIVE' ||
    data.publication === 'EMPTY' ||
    data.publication === 'HISTORICAL';
  const budgetLimit = campaign.budget.discountBudgetToman;
  const budgetUsed = Math.max(0, budgetLimit - campaign.budget.remainingDiscountToman);
  const usedPercent = budgetLimit > 0 ? Math.round((100 * budgetUsed) / budgetLimit) : 0;

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
        <div className="flex flex-wrap items-center gap-2">
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

      {festival && (
        <Card title="وضعیت انتشار جشنواره">
          <Metrics
            rows={[
              ['شروع', formatAdminDateTime(campaign.startsAt)],
              ['پایان', formatAdminDateTime(campaign.endsAt)],
              [
                'تا پایان',
                campaign.archivedAt || campaign.status === 'ENDED'
                  ? 'پایان‌یافته'
                  : timeRemaining(campaign.endsAt, data.checkedAt),
              ],
              [
                'آخرین نسخهٔ منتشرشده',
                festival.version === null ? 'ثبت نشده' : integer(festival.version),
              ],
              ['لندینگ', campaign.archivedAt ? 'بایگانی‌شده' : publicationLabels[data.publication]],
              ['آیتم منو', festival.navigation ? 'در حال نمایش' : 'نمایش داده نمی‌شود'],
              ['نوار اعلان', festival.announcement ? 'در حال نمایش' : 'نمایش داده نمی‌شود'],
            ]}
          />
          {(festival.publicationError ||
            ['NO_LANDING', 'EMPTY', 'UNKNOWN'].includes(data.publication)) && (
            <Alert tone="warning" title="نیاز به بررسی انتشار" className="mt-3">
              <p>
                {festival.publicationError
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
      )}

      <Card title={festival ? 'سفارش‌ها و پرداخت‌ها' : 'سفارش، پرداخت و انتشار'}>
        {!festival && (
          <p className="mb-3 text-sm">
            {campaign.archivedAt
              ? 'صفحهٔ این دوره بایگانی شده است.'
              : campaign.kind === 'MARKETING' && data.publication === 'NO_LANDING'
                ? 'کمپین بازاریابی از پیوند مقصد تعیین‌شده استفاده می‌کند.'
                : publicationLabels[data.publication]}
          </p>
        )}
        {!festival && observedIssues > 0 && (
          <div className="mb-3">
            <Alert tone="warning">
              رد رسید، پرداخت ناموفق، نیاز به تطبیق یا رزرو گذشته از مهلت ثبت شده است. برای رسیدگی،
              سفارش مرتبط را باز کنید.
            </Alert>
          </div>
        )}
        <Metrics
          rows={[
            ['سفارش ثبت‌شده', integer(orders.registered)],
            ['خرید تأییدشده', integer(orders.confirmed)],
            ['در انتظار پرداخت', integer(orders.pending)],
            ['رسید در انتظار بررسی', integer(orders.awaitingReceipt)],
            ['رسید ردشده', integer(orders.rejectedReceipt)],
            ['لغوشده', integer(orders.cancelled)],
            ['نیازمند تطبیق', integer(orders.reconciliation)],
            ...(!festival
              ? ([
                  ['پرداخت ناموفق', integer(orders.paymentFailed)],
                  ['مهلت رزرو گذشته', integer(orders.overdueReservations)],
                  ['منقضی‌شده', integer(orders.expired)],
                ] as const)
              : []),
          ]}
        />
        <p className="mt-3 text-xs leading-6 text-[var(--admin-color-muted)]">
          وضعیت خرید و پرداخت بر اساس سفارش‌های ثبت‌شدهٔ مرتبط با کمپین است. مهلت رزرو و تطبیق
          می‌توانند هم‌زمان با وضعیت‌های دیگر ثبت شوند.
        </p>
        <form action="/campaigns" method="get" className="mt-4 flex flex-wrap items-end gap-2">
          <input type="hidden" name="id" value={campaign.id} />
          <input type="hidden" name="step" value="operations" />
          {data.quotaPage > 1 && <input type="hidden" name="quotaPage" value={data.quotaPage} />}
          <label className="grid gap-1 text-sm">
            فیلتر وضعیت
            <select
              name="orderState"
              defaultValue={orderState ?? ''}
              className="min-h-9 rounded-md border border-[var(--admin-color-border)] px-2"
            >
              <option value="">همهٔ وضعیت‌ها</option>
              {Object.entries(campaignOrderLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            ترتیب ثبت
            <select
              name="orderSort"
              defaultValue={orderSort}
              className="min-h-9 rounded-md border border-[var(--admin-color-border)] px-2"
            >
              <option value="newest">جدیدترین</option>
              <option value="oldest">قدیمی‌ترین</option>
            </select>
          </label>
          <button
            type="submit"
            className="min-h-9 rounded-md border border-[var(--admin-color-border)] px-3 text-sm font-semibold"
          >
            اعمال فیلتر
          </button>
        </form>
        {data.orderItems.length ? (
          <div className="mt-3 overflow-x-auto">
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
          </div>
        ) : (
          <p role="status" className="mt-4 text-sm">
            سفارشی برای این فیلتر ثبت نشده است.
          </p>
        )}
        <PageLinks
          label="صفحات سفارش‌های کمپین"
          page={data.orderPage}
          hasMore={data.hasMoreOrders}
          url={(page) => operationPath(page, data.quotaPage)}
        />
      </Card>

      <Card
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
        {!festival && shortfall && (
          <div className="mt-3">
            <Alert tone="warning">
              در ردیف‌های این صفحه، موجودی بعضی محصولات کمتر از ماندهٔ سهمیه است.
            </Alert>
          </div>
        )}
        {data.quotaItems.length ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[44rem] text-sm">
              <thead>
                <tr>
                  {[
                    'محصول',
                    ...(festival ? ['وضعیت محصول', 'قیمت پیش‌فرض'] : []),
                    'سقف',
                    'فروش سایت',
                    'فروش دستی',
                    'رزرو',
                    'مانده',
                    'موجودی',
                    'اختلاف',
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
                      <QuotaProductName
                        row={row}
                        festival={Boolean(festival)}
                        canEditCatalog={canEditCatalog}
                      />
                    </th>
                    {festival && (
                      <>
                        <td className={cell}>{productStatusLabels[row.productStatus]}</td>
                        <td className={cell}>
                          {row.defaultPriceToman === null
                            ? 'ثبت نشده'
                            : money(row.defaultPriceToman)}
                        </td>
                      </>
                    )}
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
                      {row.stockShortfall > 0 ? (
                        <Badge tone="warning">{integer(row.stockShortfall)} کسری</Badge>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
          url={(page) => operationPath(data.orderPage, page)}
        />
      </Card>

      {finance && (
        <Card
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
              ['تخفیف تعهدشده', money(campaign.budget.committedDiscountToman)],
              ...('committedReferralRewardToman' in campaign.budget &&
              typeof campaign.budget.committedReferralRewardToman === 'number'
                ? [
                    [
                      'پاداش معرف صادرشده',
                      money(campaign.budget.committedReferralRewardToman),
                    ] as const,
                  ]
                : []),
              ['بودجهٔ تخفیف باقی‌مانده', money(campaign.budget.remainingDiscountToman)],
            ]}
          />
          {festival && budgetLimit > 0 && (
            <label className="mt-3 grid gap-1 text-sm">
              <span>بودجهٔ درگیر {integer(usedPercent)}٪</span>
              <progress
                className="h-2 w-full accent-[var(--admin-color-info)]"
                max={budgetLimit}
                value={budgetUsed}
              />
            </label>
          )}
          {festival && campaign.budget.blockers.length > 0 && (
            <Alert tone="warning" title="مانع انتشار یا ادامهٔ تخفیف" className="mt-3">
              <ul>
                {campaign.budget.blockers.map((reason) => (
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
      {festival && (
        <Card title="سلامت عملیاتی">
          <ul className="space-y-2 text-sm">
            <li>
              <Link className="underline" href={operationPath(1, data.quotaPage, 'PAYMENT_FAILED')}>
                پرداخت ناموفق
              </Link>{' '}
              {integer(orders.paymentFailed)}
            </li>
            <li>
              <Link className="underline" href={operationPath(1, data.quotaPage, 'RECONCILIATION')}>
                نیازمند تطبیق پرداخت
              </Link>{' '}
              {integer(orders.reconciliation)}
            </li>
            <li>رزروهای گذشته از مهلت {integer(orders.overdueReservations)}</li>
            <li>محصولات با کسری موجودی نسبت به سهمیه {integer(festival.stockShortfallProducts)}</li>
            <li>
              محصولات فعال سهمیه‌دار بدون قیمت پیش‌فرض معتبر{' '}
              {integer(festival.missingDefaultPriceProducts)}
            </li>
          </ul>
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
        </Card>
      )}
    </div>
  );
}
