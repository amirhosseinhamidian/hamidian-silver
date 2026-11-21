import Link from 'next/link';
import { cookies } from 'next/headers';

import { CampaignDetailView } from '@/components/campaigns/campaign-detail-view';
import { CampaignEditor } from '@/components/campaigns/campaign-editor';
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
  const { id, create, page, history, edit } = await searchParams;
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
    content = campaign ? (
      edit === '1' && canWrite && campaign.status === 'DRAFT' ? (
        <CampaignEditor key={`${campaign.id}-${campaign.revision}`} campaign={campaign} />
      ) : (
        <CampaignDetailView
          key={`${campaign.id}-${campaign.revision}`}
          campaign={campaign}
          canWrite={canWrite}
        />
      )
    ) : (
      <Alert tone="danger">
        {result?.response.status === 404 ? 'کمپین پیدا نشد.' : 'دریافت کمپین ممکن نشد.'}
      </Alert>
    );
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
                  href={`/campaigns?id=${campaign.id}`}
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
    <div className="space-y-5">
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
