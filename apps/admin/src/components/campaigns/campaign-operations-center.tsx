import type { components } from '@hamidian/contracts';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { campaignStatusLabels, type CampaignDetail } from '@/lib/campaigns/campaign-model';
import {
  formatAdminDateTime,
  formatAdminInteger,
  formatAdminToman,
} from '@/lib/presentation/formatters';
import { CampaignEmergencyPause } from './campaign-emergency-pause';

type Operations = components['schemas']['CampaignOperationsCenterDto'];
type OrderState = components['schemas']['CampaignOrderOperationDto']['state'];

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
};

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
  canWrite,
  canEditCatalog,
  canReadAudit,
}: {
  campaign: CampaignDetail;
  data: Operations;
  orderState?: OrderState;
  canWrite: boolean;
  canEditCatalog: boolean;
  canReadAudit: boolean;
}) {
  const { orders, quota, finance } = data;
  const reportPath = `/growth/campaigns/${encodeURIComponent(campaign.trackingId)}`;
  const operationPath = (orderPage: number, quotaPage: number, filter = orderState) => {
    const query = new URLSearchParams({ id: campaign.id, step: 'operations' });
    if (orderPage > 1) query.set('orderPage', String(orderPage));
    if (quotaPage > 1) query.set('quotaPage', String(quotaPage));
    if (filter) query.set('orderState', filter);
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

  return (
    <div className="space-y-5">
      <Card
        title={campaign.name}
        description={`آخرین بررسی ${formatAdminDateTime(data.checkedAt)}`}
        action={
          <Badge tone={campaign.status === 'ACTIVE' ? 'success' : 'neutral'}>
            {campaignStatusLabels[campaign.status]}
          </Badge>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          {canWrite && active && (
            <CampaignEmergencyPause key={campaign.revision} campaign={campaign} />
          )}
          <ButtonLink href={`/campaigns?id=${campaign.id}&step=review`} variant="outline" size="sm">
            چرخه و تاریخچهٔ کمپین
          </ButtonLink>
          {canReadAudit && (
            <ButtonLink href="/audit" variant="outline" size="sm">
              گزارش عملیات مدیران
            </ButtonLink>
          )}
          {data.landingSlug && (
            <ButtonLink
              href={`${storefrontOrigin}/campaigns/${encodeURIComponent(data.landingSlug)}`}
              target="_blank"
              rel="noreferrer"
              variant="outline"
              size="sm"
            >
              صفحهٔ کمپین
            </ButtonLink>
          )}
        </div>
      </Card>

      <Card title="سفارش، پرداخت و انتشار">
        <p className="mb-3 text-sm">{publicationLabels[data.publication]}</p>
        {observedIssues > 0 && (
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
            ['پرداخت ناموفق', integer(orders.paymentFailed)],
            ['نیازمند تطبیق', integer(orders.reconciliation)],
            ['مهلت رزرو گذشته', integer(orders.overdueReservations)],
            ['منقضی‌شده', integer(orders.expired)],
            ['لغوشده', integer(orders.cancelled)],
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
        {shortfall && (
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
                      {canEditCatalog ? (
                        <Link className="underline" href={`/products/${row.productId}/edit`}>
                          {row.name}
                        </Link>
                      ) : (
                        <Link
                          className="underline"
                          href={`${storefrontOrigin}/products/${encodeURIComponent(row.slug)}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {row.name}
                        </Link>
                      )}
                    </th>
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
        <ButtonLink
          href={`/campaigns?id=${campaign.id}&step=promotion`}
          variant="outline"
          size="sm"
          className="mt-3"
        >
          مدیریت سهمیه و فروش دستی
        </ButtonLink>
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
              ['بودجهٔ تخفیف باقی‌مانده', money(campaign.budget.remainingDiscountToman)],
            ]}
          />
        </Card>
      )}
    </div>
  );
}
