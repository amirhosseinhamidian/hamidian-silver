import type { paths } from '@hamidian/contracts';
import Link from 'next/link';
import { cookies } from 'next/headers';

import { CampaignOperationsCenter } from '@/components/campaigns/campaign-operations-center';
import { CampaignDetailView } from '@/components/campaigns/campaign-detail-view';
import { CampaignBudgetReview } from '@/components/campaigns/campaign-budget-review';
import { FestivalWorkspace } from '@/components/campaigns/festival-workspace';
import { CampaignLandingEditor } from '@/components/campaigns/campaign-landing-editor';
import { CampaignEditor } from '@/components/campaigns/campaign-editor';
import { MarketingCampaignEditor } from '@/components/campaigns/marketing-campaign-editor';
import { CampaignSalesPanel } from '@/components/campaigns/campaign-sales-panel';
import { SalesCampaignFilters } from '@/components/campaigns/sales-campaign-filters';
import { FestivalWizard } from '@/components/campaigns/festival-wizard';
import {
  FestivalDraftLink,
  FestivalWizardNavigation,
} from '@/components/campaigns/festival-wizard-navigation';
import { CampaignLinkBuilder } from '@/components/site-settings/campaign-link-builder';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { requireAdminSession } from '@/lib/auth/session';
import { createAdminApiClient } from '@/lib/auth/server-api';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import {
  campaignKindLabels,
  campaignOperationsOrderLabels,
  campaignStatusLabels,
  isCampaignId,
} from '@/lib/campaigns/campaign-model';
import { festivalStep } from '@/lib/campaigns/festival-wizard';
import { loadCampaignPerformance } from '@/lib/growth/growth-data';
import { parseGrowthFilters } from '@/lib/growth/growth-report';
import { readCalendarValue } from '@/lib/presentation/dual-calendar';
import {
  formatAdminInteger,
  formatAdminToman,
  toPersianDigits,
} from '@/lib/presentation/formatters';

type Props = {
  searchParams: Promise<{
    page?: string;
    view?: string;
    q?: string;
    status?: string;
    fromTehran?: string;
    toTehran?: string;
    sort?: string;
    salesKind?: string;
    id?: string;
    history?: string;
    create?: string;
    edit?: string;
    step?: string;
    orderPage?: string;
    quotaPage?: string;
    orderState?: string;
    orderSort?: string;
  }>;
};

export const dynamic = 'force-dynamic';

type CampaignListQuery = NonNullable<paths['/api/v1/campaigns']['get']['parameters']['query']>;
type CampaignListView = NonNullable<CampaignListQuery['view']>;

const listViews: Record<CampaignListView, { title: string; description: string }> = {
  festivals: {
    title: 'جشنواره‌های فروش',
    description: 'زمان‌بندی، طراحی و انتشار جشنواره‌های فروشگاه.',
  },
  sales: {
    title: 'کمپین‌ها و پیشنهادهای فروش',
    description: 'پیشنهادهای فروش و کمپین‌های دارای قانون تخفیف، سهمیه یا سابقهٔ قیمت‌گذاری سفارش.',
  },
  marketing: {
    title: 'کمپین‌های بازاریابی',
    description: 'فعالیت‌های بازاریابی و کمپین‌های دارای هزینهٔ کانال تبلیغاتی.',
  },
};

const listViewOptions = Object.entries(listViews) as [
  CampaignListView,
  (typeof listViews)[CampaignListView],
][];

function campaignsHref(view?: CampaignListView, page = 1, params?: Record<string, string>) {
  const query = new URLSearchParams(params);
  if (view) query.set('view', view);
  if (page > 1) query.set('page', String(page));
  return query.size > 0 ? `/campaigns?${query}` : '/campaigns';
}

function pageNumber(value?: string) {
  const page = Number(value);
  return Number.isSafeInteger(page) && page >= 1 && page <= 10_000 ? page : 1;
}

function salesFilters(
  params: Awaited<Props['searchParams']>,
): Pick<CampaignListQuery, 'q' | 'status' | 'fromTehran' | 'toTehran' | 'sort' | 'salesKind'> {
  const q = typeof params.q === 'string' ? params.q.trim().slice(0, 150) : '';
  const status =
    typeof params.status === 'string' && Object.hasOwn(campaignStatusLabels, params.status)
      ? (params.status as keyof typeof campaignStatusLabels)
      : undefined;
  const fromTehran =
    typeof params.fromTehran === 'string' && readCalendarValue(params.fromTehran, 'date-time')
      ? params.fromTehran
      : undefined;
  const toTehran =
    typeof params.toTehran === 'string' && readCalendarValue(params.toTehran, 'date-time')
      ? params.toTehran
      : undefined;
  return {
    ...(q ? { q } : {}),
    ...(status ? { status } : {}),
    ...(fromTehran ? { fromTehran } : {}),
    ...(toTehran ? { toTehran } : {}),
    ...(params.sort === 'oldest' ? { sort: 'oldest' as const } : {}),
    ...(params.salesKind === 'offers' || params.salesKind === 'existing'
      ? { salesKind: params.salesKind }
      : {}),
  };
}

export default async function CampaignsPage({ searchParams }: Props) {
  const user = await requireAdminSession({
    permissions: ['settings.read'],
    returnTo: '/campaigns',
  });
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const params = await searchParams;
  const {
    id,
    create,
    page,
    view,
    history,
    edit,
    step,
    orderPage,
    quotaPage,
    orderState,
    orderSort,
  } = params;
  const listView = listViewOptions.find(([key]) => key === view)?.[0];
  const listPage = pageNumber(page);
  const filters = listView === 'sales' ? salesFilters(params) : {};
  const listQuery = {
    ...filters,
    ...(listView ? { view: listView } : {}),
    ...(listPage > 1 ? { page: String(listPage) } : {}),
  };
  const canReadOperations = user.permissions.includes('orders.read');
  const operationsPage = (value?: string) => Math.min(pageNumber(value), 1000);
  const orderFilter =
    typeof orderState === 'string' && Object.hasOwn(campaignOperationsOrderLabels, orderState)
      ? (orderState as keyof typeof campaignOperationsOrderLabels)
      : undefined;
  const sort = orderSort === 'oldest' ? 'oldest' : 'newest';
  const canWrite = user.permissions.includes('settings.write');
  const canReadFinance = user.permissions.includes('finance.read');
  const client = createAdminApiClient(token);
  const createKinds = { '1': 'FESTIVAL', marketing: 'MARKETING', sales: 'SALES' } as const;
  const createKind =
    typeof create === 'string' && Object.hasOwn(createKinds, create)
      ? createKinds[create as keyof typeof createKinds]
      : null;
  const showingList = id === undefined && !(createKind && canWrite);
  let returnView = listView;

  let content;
  if (createKind && canWrite) {
    returnView ??=
      createKind === 'FESTIVAL' ? 'festivals' : createKind === 'SALES' ? 'sales' : 'marketing';
    content =
      createKind === 'FESTIVAL' ? (
        <>
          <FestivalWizardNavigation accountId={user.id} name="جشنوارهٔ جدید" step="basics" />
          <CampaignEditor key={createKind} createKind={createKind} view="basics" />
        </>
      ) : createKind === 'MARKETING' ? (
        <MarketingCampaignEditor listPath={campaignsHref('marketing', listPage)} />
      ) : (
        <CampaignEditor key={createKind} createKind={createKind} listQuery={listQuery} />
      );
  } else if (id !== undefined) {
    const result =
      typeof id === 'string' && isCampaignId(id)
        ? await client
            .GET('/api/v1/campaigns/{id}', {
              cache: 'no-store',
              params: { path: { id }, query: { page: pageNumber(history) } },
            })
            .catch(() => null)
        : null;
    const campaign = result?.data;
    if (campaign?.kind === 'FESTIVAL') returnView ??= 'festivals';
    if (campaign?.managementPurpose === 'SALES') returnView ??= 'sales';
    if (campaign?.marketing) {
      returnView = 'marketing';
      const listPath = campaignsHref('marketing', listPage);
      const detailPath = campaignsHref('marketing', listPage, { id: campaign.id });
      const reportPath = `/growth/campaigns/${encodeURIComponent(campaign.trackingId)}`;
      const canEdit = canWrite && campaign.status === 'DRAFT';
      const editing = edit === '1' && canEdit;
      const tracking = step === 'links' && canWrite;
      const performance =
        canReadFinance && !editing && !tracking
          ? await loadCampaignPerformance(campaign.trackingId, parseGrowthFilters({}))
          : null;
      const mediaCost = performance?.report?.budget?.lifetimeMediaSpendToman;
      const { destinationPath, relatedFestivalId, relatedSalesCampaignId } = campaign.marketing;
      content = (
        <>
          <nav className="flex flex-wrap gap-2" aria-label="مدیریت کمپین بازاریابی">
            <ButtonLink
              href={detailPath}
              variant={!editing && !tracking ? 'secondary' : 'outline'}
              aria-current={!editing && !tracking ? 'page' : undefined}
            >
              جزئیات و وضعیت
            </ButtonLink>
            {canEdit && (
              <ButtonLink
                href={`${detailPath}&edit=1`}
                variant={editing ? 'secondary' : 'outline'}
                aria-current={editing ? 'page' : undefined}
              >
                ویرایش پیش‌نویس
              </ButtonLink>
            )}
            {canWrite && (
              <ButtonLink
                href={`${detailPath}&step=links`}
                variant={tracking ? 'secondary' : 'outline'}
                aria-current={tracking ? 'page' : undefined}
              >
                لینک ردیابی
              </ButtonLink>
            )}
            {canReadFinance && (
              <ButtonLink href={reportPath} variant="outline">
                گزارش عملکرد و هزینه‌ها
              </ButtonLink>
            )}
          </nav>
          {editing ? (
            <MarketingCampaignEditor
              key={campaign.revision}
              campaign={campaign}
              listPath={listPath}
            />
          ) : tracking ? (
            campaign.channel === 'direct' || campaign.channel === 'none' ? (
              <Alert tone="info">
                برای کانال مستقیم از مسیر مقصد <bdi>{destinationPath}</bdi> استفاده کنید. ترافیک
                مستقیم بدون پارامتر ردیابی ثبت می‌شود.
              </Alert>
            ) : (
              <CampaignLinkBuilder
                fixedDestination
                campaignName={campaign.name}
                campaignStatus={campaignStatusLabels[campaign.status]}
                canReadReports={canReadFinance}
                campaign={{
                  destination: destinationPath,
                  campaignId: campaign.trackingId,
                  campaign: campaign.trackingLabel,
                  medium: campaign.channel,
                }}
              />
            )
          ) : (
            <>
              <Card title="مقصد و هزینهٔ کمپین">
                <dl className="grid gap-3 text-sm sm:grid-cols-3">
                  <div className="min-w-0 [overflow-wrap:anywhere]">
                    <dt>مسیر مقصد</dt>
                    <dd>
                      <bdi>{destinationPath}</bdi>
                    </dd>
                  </div>
                  <div>
                    <dt>بودجهٔ برنامه‌ریزی‌شدهٔ تبلیغات</dt>
                    <dd>{formatAdminToman(campaign.budgetToman)}</dd>
                  </div>
                  {canReadFinance && (
                    <div>
                      <dt>هزینهٔ تبلیغات ثبت‌شده</dt>
                      <dd>
                        {performance?.report
                          ? mediaCost == null
                            ? 'ثبت نشده'
                            : formatAdminToman(mediaCost)
                          : 'دریافت هزینه ممکن نشد'}
                      </dd>
                    </div>
                  )}
                </dl>
                {(relatedFestivalId || relatedSalesCampaignId) && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {relatedFestivalId && (
                      <ButtonLink
                        href={campaignsHref('festivals', 1, { id: relatedFestivalId })}
                        size="sm"
                        variant="outline"
                      >
                        جشنوارهٔ مرتبط
                      </ButtonLink>
                    )}
                    {relatedSalesCampaignId && (
                      <ButtonLink
                        href={campaignsHref('sales', 1, { id: relatedSalesCampaignId })}
                        size="sm"
                        variant="outline"
                      >
                        پیشنهاد فروش مرتبط
                      </ButtonLink>
                    )}
                  </div>
                )}
              </Card>
              <CampaignDetailView
                key={campaign.revision}
                campaign={campaign}
                canWrite={canWrite}
                detailPath={detailPath}
              />
            </>
          )}
        </>
      );
    } else if (campaign?.kind === 'FESTIVAL' && step !== 'operations') {
      content = (
        <FestivalWizard
          campaign={campaign}
          client={client}
          accountId={user.id}
          step={
            edit === '1' && campaign.status === 'DRAFT'
              ? 'basics'
              : (festivalStep(step) ?? 'review')
          }
          canWrite={canWrite}
          canReadOperations={canReadOperations}
          canReadFinance={canReadFinance}
        />
      );
    } else if (campaign) {
      const isSalesOffer = campaign.managementPurpose === 'SALES';
      const canConfigureLanding = !isSalesOffer && campaign.kind !== 'MARKETING';
      const canBuildLinks = canWrite && !isSalesOffer && campaign.kind !== 'FESTIVAL';
      const [promotion, landing, festival] =
        step !== 'operations' && !(edit === '1' && canWrite && campaign.status === 'DRAFT')
          ? await Promise.all([
              client
                .GET('/api/v1/promotions/{campaignId}', {
                  params: { path: { campaignId: campaign.id } },
                  cache: 'no-store',
                })
                .catch(() => null),
              canConfigureLanding
                ? client
                    .GET('/api/v1/campaigns/{id}/landing', {
                      params: { path: { id: campaign.id } },
                      cache: 'no-store',
                    })
                    .catch(() => null)
                : null,
              step === 'landing' && canConfigureLanding
                ? client
                    .GET('/api/v1/campaigns/{id}/design', {
                      params: { path: { id: campaign.id } },
                      cache: 'no-store',
                    })
                    .catch(() => null)
                : null,
            ])
          : [null, null, null];
      const editing = edit === '1' && canWrite && campaign.status === 'DRAFT';
      const currentStep =
        step === 'operations' ||
        (step === 'landing' && canConfigureLanding) ||
        step === 'promotion' ||
        (step === 'links' && canBuildLinks)
          ? step
          : 'review';
      const url = campaignsHref(returnView, listPage, { id: campaign.id, ...filters });
      let panel;
      if (editing) {
        panel = (
          <CampaignEditor
            key={`${campaign.id}-${campaign.revision}`}
            campaign={campaign}
            listQuery={listQuery}
          />
        );
      } else if (currentStep === 'operations') {
        const operations = canReadOperations
          ? await client
              .GET('/api/v1/campaigns/{id}/operations', {
                cache: 'no-store',
                params: {
                  path: { id: campaign.id },
                  query: {
                    orderPage: operationsPage(orderPage),
                    quotaPage: operationsPage(quotaPage),
                    orderState: orderFilter,
                    orderSort: sort,
                  },
                },
              })
              .catch(() => null)
          : null;
        panel = operations?.data ? (
          <CampaignOperationsCenter
            campaign={campaign}
            data={operations.data}
            listQuery={listQuery}
            orderState={orderFilter}
            orderSort={sort}
            canWrite={canWrite}
            canEditCatalog={user.permissions.includes('catalog.write')}
            canReadAudit={user.permissions.includes('audit.read')}
          />
        ) : (
          <Alert tone="danger">
            {canReadOperations
              ? 'دریافت داده‌های عملیاتی ممکن نشد.'
              : 'مشاهدهٔ مرکز عملیات به دسترسی خواندن سفارش‌ها نیاز دارد.'}
          </Alert>
        );
      } else if (currentStep === 'landing') {
        panel =
          landing?.data?.landing && festival?.data ? (
            <FestivalWorkspace
              key={`${campaign.id}-${landing.data.revision}-${festival.data.revision}`}
              campaign={campaign}
              landing={landing.data}
              festival={festival.data}
              canWrite={canWrite}
            />
          ) : landing?.data ? (
            <>
              <CampaignLandingEditor
                key={`landing-${campaign.id}-${landing.data.revision}`}
                campaign={campaign}
                editor={landing.data}
                canWrite={canWrite}
              />
              {landing.data.landing && <Alert tone="danger">دریافت طرح جشنواره ممکن نشد.</Alert>}
            </>
          ) : (
            <Alert tone="danger">دریافت تنظیمات صفحهٔ کمپین ممکن نشد.</Alert>
          );
      } else if (currentStep === 'promotion') {
        panel = (
          <CampaignSalesPanel
            campaign={campaign}
            rule={promotion?.data?.rule}
            canWrite={canWrite}
          />
        );
      } else if (currentStep === 'links') {
        const destination = landing?.data?.landing?.slug;
        panel = (
          <CampaignLinkBuilder
            campaignName={campaign.name}
            campaignStatus={campaignStatusLabels[campaign.status]}
            canReadReports={canReadFinance}
            campaign={{
              destination: destination
                ? `/campaigns/${destination}`
                : (campaign.ctaPath ?? '/products'),
              campaignId: campaign.trackingId,
              campaign: campaign.trackingLabel,
              medium: campaign.channel,
            }}
          />
        );
      } else {
        panel = (
          <>
            <CampaignBudgetReview
              key={`budget-${campaign.revision}`}
              campaign={campaign}
              rule={promotion?.data?.rule ?? null}
            />
            {!promotion?.data && <Alert tone="danger">دریافت قانون تخفیف ممکن نشد.</Alert>}
            <CampaignDetailView
              key={`${campaign.id}-${campaign.revision}`}
              campaign={campaign}
              canWrite={canWrite}
              detailPath={url}
            />
          </>
        );
      }
      const steps = [
        ...(canReadOperations ? [{ id: 'operations', title: 'مرکز عملیات' }] : []),
        ...(canConfigureLanding ? [{ id: 'landing', title: 'صفحه و مجموعه' }] : []),
        { id: 'promotion', title: isSalesOffer ? 'تخفیف، سهمیه و پیش‌نمایش' : 'قانون و کوپن' },
        { id: 'review', title: isSalesOffer ? 'تأیید و زمان‌بندی' : 'پیش‌نمایش و انتشار' },
        ...(canBuildLinks ? [{ id: 'links', title: 'ساخت لینک' }] : []),
      ];
      content = (
        <>
          <nav className="flex flex-wrap gap-2" aria-label="مراحل کمپین">
            {campaign.status === 'DRAFT' && canWrite && (
              <ButtonLink
                href={`${url}&edit=1`}
                variant={editing ? 'secondary' : 'outline'}
                aria-current={editing ? 'step' : undefined}
              >
                {isSalesOffer ? 'اطلاعات و زمان‌بندی پیشنهاد' : 'اطلاعات کمپین'}
              </ButtonLink>
            )}
            {steps.map(({ id, title }) => (
              <ButtonLink
                key={id}
                href={`${url}&step=${id}`}
                variant={!editing && currentStep === id ? 'secondary' : 'outline'}
                aria-current={!editing && currentStep === id ? 'step' : undefined}
              >
                {title}
              </ButtonLink>
            ))}
          </nav>
          {currentStep !== 'operations' && canReadFinance && (
            <ButtonLink
              href={
                campaign.kind === 'FESTIVAL'
                  ? `/growth/festivals/${encodeURIComponent(campaign.id)}`
                  : `/growth/campaigns/${encodeURIComponent(campaign.trackingId)}`
              }
              variant="outline"
              size="sm"
            >
              گزارش عملکرد کمپین
            </ButtonLink>
          )}
          {panel}
        </>
      );
    } else {
      content = (
        <Alert tone="danger">
          {result?.response.status === 404 ? 'کمپین پیدا نشد.' : 'دریافت کمپین ممکن نشد.'}
        </Alert>
      );
    }
  } else {
    const result = await client
      .GET('/api/v1/campaigns', {
        cache: 'no-store',
        params: { query: { page: listPage, view: listView, ...filters } },
      })
      .catch(() => null);
    const list = result?.data;
    content = list ? (
      <Card title="تقویم کمپین‌ها" description="همهٔ زمان‌ها به وقت تهران است.">
        {list.items.length === 0 ? (
          <p className="text-sm">
            {Object.keys(filters).length > 0
              ? 'پیشنهادی مطابق این فیلترها پیدا نشد.'
              : 'در این فهرست هنوز کمپینی برای نمایش وجود ندارد.'}
          </p>
        ) : (
          <ul className="divide-y divide-[var(--admin-color-border)]">
            {list.items.map((campaign) => (
              <li
                key={campaign.id}
                className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:items-center sm:gap-5"
              >
                <div className="min-w-0 space-y-1 [overflow-wrap:anywhere]">
                  {campaign.kind === 'FESTIVAL' && campaign.status === 'DRAFT' ? (
                    <FestivalDraftLink accountId={user.id} id={campaign.id} name={campaign.name} />
                  ) : (
                    <Link
                      href={campaignsHref(listView, list.page, {
                        id: campaign.id,
                        ...filters,
                        ...(canReadOperations && campaign.status !== 'DRAFT'
                          ? { step: 'operations' }
                          : {}),
                      })}
                      className="font-semibold underline-offset-4 hover:underline"
                    >
                      {campaign.name}
                    </Link>
                  )}
                  <p className="text-xs text-[var(--admin-color-muted)]">
                    {campaign.managementPurpose === 'SALES'
                      ? 'پیشنهاد فروش'
                      : listView === 'sales'
                        ? campaign.kind === 'MARKETING'
                          ? 'بازاریابی و فروش'
                          : 'کمپین فروش'
                        : campaignKindLabels[campaign.kind]}
                  </p>
                </div>
                <Badge tone={campaign.status === 'ACTIVE' ? 'success' : 'neutral'}>
                  {campaign.archivedAt ? 'بایگانی‌شده' : campaignStatusLabels[campaign.status]}
                </Badge>
                <span className="text-xs">
                  آغاز <bdi>{toPersianDigits(campaign.startsTehran)}</bdi>
                </span>
                <span className="text-xs">
                  پایان <bdi>{toPersianDigits(campaign.endsTehran)}</bdi>
                </span>
                {campaign.salesDetails && (
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--admin-color-muted)] sm:col-span-full">
                    <span>
                      {campaign.salesDetails.allProducts
                        ? 'همهٔ محصولات'
                        : `${formatAdminInteger(campaign.salesDetails.selectedProducts)} محصول و ${formatAdminInteger(campaign.salesDetails.selectedCategories)} دستهٔ انتخابی`}
                    </span>
                    <span>
                      سقف بودجهٔ تخفیف {formatAdminToman(campaign.salesDetails.discountBudgetToman)}
                    </span>
                    <span>
                      {formatAdminInteger(campaign.salesDetails.quotaProducts)} محصول دارای سهمیه
                    </span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {list.page > 1 || list.hasMore ? (
          <nav aria-label="صفحات کمپین‌ها" className="mt-4 flex items-center gap-3 text-sm">
            {list.page > 1 && (
              <ButtonLink
                href={campaignsHref(listView, list.page - 1, filters)}
                variant="outline"
                size="sm"
              >
                صفحهٔ قبل
              </ButtonLink>
            )}
            <span>صفحهٔ {formatAdminInteger(list.page)}</span>
            {list.hasMore && list.page < 10_000 && (
              <ButtonLink
                href={campaignsHref(listView, list.page + 1, filters)}
                variant="outline"
                size="sm"
              >
                صفحهٔ بعد
              </ButtonLink>
            )}
          </nav>
        ) : null}
      </Card>
    ) : (
      <Alert tone="danger">
        {result?.response.status === 400 && listView === 'sales'
          ? 'فیلترها را بررسی کنید. پایان بازه باید پس از آغاز آن باشد.'
          : 'دریافت فهرست کمپین‌ها ممکن نشد.'}
      </Alert>
    );
  }

  const selectedView = listView ? listViews[listView] : undefined;
  return (
    <main className="admin-container min-w-0 space-y-5 py-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h1 className="text-xl font-bold">
            {showingList ? (selectedView?.title ?? 'نمای کلی بازاریابی') : 'جشنواره‌ها و کمپین‌ها'}
          </h1>
          {showingList && selectedView && (
            <p className="text-sm text-[var(--admin-color-muted)]">{selectedView.description}</p>
          )}
        </div>
        {!showingList ? (
          <ButtonLink href={campaignsHref(returnView, listPage, filters)} variant="outline">
            {returnView ? `بازگشت به ${listViews[returnView].title}` : 'بازگشت به فهرست کمپین‌ها'}
          </ButtonLink>
        ) : (
          <div className="flex flex-wrap gap-2">
            {listView === 'festivals' && (
              <ButtonLink href="/campaigns/themes" variant="outline">
                کتابخانهٔ تم‌ها
              </ButtonLink>
            )}
            {listView === 'festivals' && canWrite && (
              <ButtonLink href={campaignsHref(listView, listPage, { create: '1' })}>
                جشنوارهٔ جدید
              </ButtonLink>
            )}
            {listView === 'marketing' && canWrite && (
              <ButtonLink href={campaignsHref(listView, listPage, { create: 'marketing' })}>
                کمپین بازاریابی جدید
              </ButtonLink>
            )}
            {listView === 'sales' && canWrite && (
              <ButtonLink href={campaignsHref(listView, listPage, { create: 'sales', ...filters })}>
                پیشنهاد فروش جدید
              </ButtonLink>
            )}
          </div>
        )}
      </header>
      {showingList && (
        <nav aria-label="مسیرهای بازاریابی و رشد" className="flex flex-wrap gap-2">
          <ButtonLink
            href="/campaigns"
            variant={listView ? 'outline' : 'secondary'}
            aria-current={listView ? undefined : 'page'}
          >
            همهٔ کمپین‌ها
          </ButtonLink>
          {listViewOptions.map(([key, { title }]) => (
            <ButtonLink
              key={key}
              href={campaignsHref(key)}
              variant={listView === key ? 'secondary' : 'outline'}
              aria-current={listView === key ? 'page' : undefined}
            >
              {title}
            </ButtonLink>
          ))}
          {canWrite && (
            <ButtonLink href="/settings#campaign-links" variant="outline">
              لینک‌های ردیابی
            </ButtonLink>
          )}
          {canReadFinance && (
            <ButtonLink href="/growth" variant="outline">
              گزارش‌های بازاریابی و رشد
            </ButtonLink>
          )}
        </nav>
      )}
      {showingList && listView === 'sales' && (
        <SalesCampaignFilters key={JSON.stringify(filters)} filters={filters} />
      )}
      {content}
    </main>
  );
}
