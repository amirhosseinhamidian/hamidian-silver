import Link from 'next/link';
import { cookies } from 'next/headers';

import {
  CampaignOperationsCenter,
  campaignOrderLabels,
} from '@/components/campaigns/campaign-operations-center';
import { CampaignDetailView } from '@/components/campaigns/campaign-detail-view';
import { CampaignBudgetReview } from '@/components/campaigns/campaign-budget-review';
import { FestivalDesigner } from '@/components/campaigns/festival-designer';
import { CampaignLandingEditor } from '@/components/campaigns/campaign-landing-editor';
import { CampaignPromotionEditor } from '@/components/campaigns/campaign-promotion-editor';
import { CampaignQuotaEditor } from '@/components/campaigns/campaign-quota-editor';
import { CampaignProductPricePreview } from '@/components/campaigns/campaign-product-price-preview';
import { CampaignEditor } from '@/components/campaigns/campaign-editor';
import { CampaignLinkBuilder } from '@/components/site-settings/campaign-link-builder';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { requireAdminSession } from '@/lib/auth/session';
import { createAdminApiClient } from '@/lib/auth/server-api';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { campaignStatusLabels, isCampaignId } from '@/lib/campaigns/campaign-model';
import { formatAdminInteger, toPersianDigits } from '@/lib/presentation/formatters';

type Props = {
  searchParams: Promise<{
    page?: string;
    id?: string;
    history?: string;
    create?: string;
    edit?: string;
    step?: string;
    orderPage?: string;
    quotaPage?: string;
    orderState?: string;
  }>;
};

export const dynamic = 'force-dynamic';

function pageNumber(value?: string) {
  const page = Number(value);
  return Number.isSafeInteger(page) && page >= 1 && page <= 10_000 ? page : 1;
}

export default async function CampaignsPage({ searchParams }: Props) {
  const user = await requireAdminSession({
    permissions: ['settings.read'],
    returnTo: '/campaigns',
  });
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const { id, create, page, history, edit, step, orderPage, quotaPage, orderState } =
    await searchParams;
  const canReadOperations = user.permissions.includes('orders.read');
  const operationsPage = (value?: string) => Math.min(pageNumber(value), 1000);
  const orderFilter =
    typeof orderState === 'string' && Object.hasOwn(campaignOrderLabels, orderState)
      ? (orderState as keyof typeof campaignOrderLabels)
      : undefined;
  const canWrite = user.permissions.includes('settings.write');
  const client = createAdminApiClient(token);

  let content;
  if (create === '1' && canWrite) {
    content = <CampaignEditor />;
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
    const [promotion, landing, festival] =
      campaign &&
      step !== 'operations' &&
      !(edit === '1' && canWrite && campaign.status === 'DRAFT')
        ? await Promise.all([
            client
              .GET('/api/v1/promotions/{campaignId}', {
                params: { path: { campaignId: campaign.id } },
                cache: 'no-store',
              })
              .catch(() => null),
            client
              .GET('/api/v1/campaigns/{id}/landing', {
                params: { path: { id: campaign.id } },
                cache: 'no-store',
              })
              .catch(() => null),
            step === 'landing'
              ? client
                  .GET('/api/v1/campaigns/{id}/design', {
                    params: { path: { id: campaign.id } },
                    cache: 'no-store',
                  })
                  .catch(() => null)
              : null,
          ])
        : [null, null, null];
    if (campaign) {
      const editing = edit === '1' && canWrite && campaign.status === 'DRAFT';
      const currentStep =
        step === 'operations' ||
        step === 'landing' ||
        step === 'promotion' ||
        (step === 'links' && canWrite)
          ? step
          : 'review';
      const url = `/campaigns?id=${campaign.id}`;
      let panel;
      if (editing) {
        panel = <CampaignEditor key={`${campaign.id}-${campaign.revision}`} campaign={campaign} />;
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
                  },
                },
              })
              .catch(() => null)
          : null;
        panel = operations?.data ? (
          <CampaignOperationsCenter
            campaign={campaign}
            data={operations.data}
            orderState={orderFilter}
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
        panel = landing?.data ? (
          <>
            <CampaignLandingEditor
              key={`landing-${campaign.id}-${landing.data.revision}`}
              campaign={campaign}
              editor={landing.data}
              canWrite={canWrite}
            />
            {landing.data.landing &&
              (festival?.data ? (
                <FestivalDesigner
                  key={`festival-${campaign.id}-${festival.data.revision}`}
                  campaignId={campaign.id}
                  editor={festival.data}
                  editable={canWrite && campaign.status === 'DRAFT'}
                />
              ) : (
                <Alert tone="danger">دریافت طرح جشنواره ممکن نشد.</Alert>
              ))}
          </>
        ) : (
          <Alert tone="danger">دریافت تنظیمات صفحهٔ کمپین ممکن نشد.</Alert>
        );
      } else if (currentStep === 'promotion') {
        panel = promotion?.data ? (
          <>
            <CampaignPromotionEditor
              key={`promotion-${campaign.id}-${promotion.data.rule?.expectedVersion ?? 0}`}
              id={campaign.id}
              rule={promotion.data.rule}
              editable={canWrite && campaign.status === 'DRAFT'}
            />
            <CampaignQuotaEditor
              key={`quota-${campaign.id}`}
              campaignId={campaign.id}
              canWrite={canWrite}
              canAdd={['DRAFT', 'APPROVED', 'SCHEDULED'].includes(campaign.status)}
            />
            <CampaignProductPricePreview
              key={`prices-${campaign.id}-${campaign.revision}`}
              campaignId={campaign.id}
            />
          </>
        ) : (
          <Alert tone="danger">دریافت قانون تخفیف ممکن نشد.</Alert>
        );
      } else if (currentStep === 'links') {
        const destination = landing?.data?.landing?.slug;
        panel = (
          <CampaignLinkBuilder
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
            />
          </>
        );
      }
      const steps = [
        ...(canReadOperations ? [{ id: 'operations', title: 'مرکز عملیات' }] : []),
        { id: 'landing', title: 'صفحه و مجموعه' },
        { id: 'promotion', title: 'قانون و کوپن' },
        { id: 'review', title: 'پیش‌نمایش و انتشار' },
        ...(canWrite ? [{ id: 'links', title: 'ساخت لینک' }] : []),
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
                اطلاعات کمپین
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
          {currentStep !== 'operations' && user.permissions.includes('finance.read') && (
            <ButtonLink
              href={`/growth/campaigns/${encodeURIComponent(campaign.trackingId)}`}
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
        params: { query: { page: pageNumber(page) } },
      })
      .catch(() => null);
    const list = result?.data;
    content = list ? (
      <Card title="تقویم کمپین‌ها" description="همهٔ زمان‌ها به وقت تهران است.">
        {list.items.length === 0 ? (
          <p className="text-sm">در این صفحه کمپینی وجود ندارد.</p>
        ) : (
          <ul className="divide-y divide-[var(--admin-color-border)]">
            {list.items.map((campaign) => (
              <li
                key={campaign.id}
                className="grid gap-2 py-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center sm:gap-5"
              >
                <Link
                  href={`/campaigns?id=${campaign.id}${canReadOperations ? '&step=operations' : ''}`}
                  className="font-semibold underline-offset-4 hover:underline"
                >
                  {campaign.name}
                </Link>
                <Badge tone={campaign.status === 'ACTIVE' ? 'success' : 'neutral'}>
                  {campaignStatusLabels[campaign.status]}
                </Badge>
                <span className="text-xs">
                  آغاز <bdi>{toPersianDigits(campaign.startsTehran)}</bdi>
                </span>
                <span className="text-xs">
                  پایان <bdi>{toPersianDigits(campaign.endsTehran)}</bdi>
                </span>
              </li>
            ))}
          </ul>
        )}
        {list.page > 1 || list.hasMore ? (
          <nav aria-label="صفحات کمپین‌ها" className="mt-4 flex items-center gap-3 text-sm">
            {list.page > 1 && (
              <ButtonLink href={`/campaigns?page=${list.page - 1}`} variant="outline" size="sm">
                صفحهٔ قبل
              </ButtonLink>
            )}
            <span>صفحهٔ {formatAdminInteger(list.page)}</span>
            {list.hasMore && list.page < 10_000 && (
              <ButtonLink href={`/campaigns?page=${list.page + 1}`} variant="outline" size="sm">
                صفحهٔ بعد
              </ButtonLink>
            )}
          </nav>
        ) : null}
      </Card>
    ) : (
      <Alert tone="danger">دریافت فهرست کمپین‌ها ممکن نشد.</Alert>
    );
  }

  return (
    <div className="min-w-0 space-y-5 px-4 py-5 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">کمپین‌های فروش</h1>
        {id !== undefined || create === '1' ? (
          <ButtonLink href="/campaigns" variant="outline">
            فهرست کمپین‌ها
          </ButtonLink>
        ) : (
          canWrite && <ButtonLink href="/campaigns?create=1">کمپین جدید</ButtonLink>
        )}
      </header>
      {content}
    </div>
  );
}
