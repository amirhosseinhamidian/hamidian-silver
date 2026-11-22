'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { campaignError } from '@/lib/campaigns/campaign-api-errors';
import {
  campaignActionLabels,
  campaignStatusLabels,
  type CampaignAction,
  type CampaignDetail,
} from '@/lib/campaigns/campaign-model';
import {
  formatAdminDateTime,
  formatAdminInteger,
  formatAdminToman,
  toPersianDigits,
} from '@/lib/presentation/formatters';

import { CampaignPreview } from './campaign-preview';

const statusActions: Record<CampaignDetail['status'], readonly CampaignAction[]> = {
  DRAFT: ['APPROVE'],
  APPROVED: ['SCHEDULE', 'REOPEN', 'END'],
  SCHEDULED: ['PAUSE', 'END'],
  ACTIVE: ['PAUSE', 'END'],
  PAUSED: ['RESUME', 'REOPEN', 'END'],
  ENDED: [],
};

const historyLabels: Record<string, string> = {
  ...campaignActionLabels,
  CREATE: 'ایجاد پیش‌نویس',
  EDIT: 'ویرایش پیش‌نویس',
  PUBLISH: 'انتشار خودکار',
  EXPIRE: 'پایان خودکار',
  LANDING_EDIT: 'ویرایش صفحه و مجموعه',
  PROMOTION_EDIT: 'ویرایش قانون تخفیف',
};

export function CampaignDetailView({
  campaign,
  canWrite,
}: {
  campaign: CampaignDetail;
  canWrite: boolean;
}) {
  const router = useRouter();
  const requests = useRef(new Map<CampaignAction, string>());
  const [pending, setPending] = useState<CampaignAction | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function transition(action: CampaignAction) {
    if (pending) return;
    if (action === 'END' && !window.confirm('پایان کمپین قطعی است. کمپین پایان یابد؟')) return;
    const requestId = requests.current.get(action) ?? crypto.randomUUID();
    requests.current.set(action, requestId);
    setPending(action);
    setError(null);
    try {
      const response = await fetch(`/api/campaigns/${campaign.id}/transitions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, expectedRevision: campaign.revision, requestId }),
      });
      if (!response.ok) {
        setError(await campaignError(response));
        return;
      }
      router.refresh();
    } catch {
      setError('ثبت وضعیت ممکن نشد. دوباره تلاش کنید.');
    } finally {
      setPending(null);
    }
  }

  const details = [
    ['هدف', campaign.goal],
    ['کانال', campaign.channel],
    [
      'مالک',
      <span key="owner" className="break-all font-mono" dir="ltr">
        {campaign.ownerId}
      </span>,
    ],
    [
      'شناسه و نام ردیابی',
      <span key="tracking" className="break-all" dir="ltr">
        {campaign.trackingId} / {campaign.trackingLabel}
      </span>,
    ],
    ['زمان آغاز به وقت تهران', <bdi key="start">{toPersianDigits(campaign.startsTehran)}</bdi>],
    ['زمان پایان به وقت تهران', <bdi key="end">{toPersianDigits(campaign.endsTehran)}</bdi>],
    [
      'محدوده',
      campaign.allProducts
        ? 'همهٔ محصولات'
        : [...campaign.productSlugs, ...campaign.categorySlugs].join('، '),
    ],
    ['سقف کل بودجه', formatAdminToman(campaign.budgetToman)],
    [
      'نمایش بنر',
      campaign.bannerEnabled
        ? `فعال با اولویت ${formatAdminInteger(campaign.bannerPriority)}`
        : 'غیرفعال',
    ],
    ['مسیر بنر', campaign.ctaPath ?? '—'],
  ] as const;
  const url = `/campaigns?id=${campaign.id}`;

  return (
    <div className="space-y-5">
      <Card
        title={campaign.name}
        description={campaign.slug}
        action={
          <Badge tone={campaign.status === 'ACTIVE' ? 'success' : 'neutral'}>
            {campaignStatusLabels[campaign.status]}
          </Badge>
        }
      >
        <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {details.map(([label, value]) => (
            <div key={label} className="min-w-0 [overflow-wrap:anywhere]">
              <dt className="text-[var(--admin-color-muted)]">{label}</dt>
              <dd className="mt-1 font-medium">{value}</dd>
            </div>
          ))}
        </dl>
        {canWrite && statusActions[campaign.status].length > 0 && (
          <div className="mt-5 space-y-3">
            {error && <Alert tone="danger">{error}</Alert>}
            {campaign.status === 'PAUSED' && (
              <p className="text-sm">
                می‌توانید با همین تنظیمات دوباره زمان‌بندی کنید یا برای اصلاح به پیش‌نویس برگردید.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {campaign.status === 'DRAFT' && (
                <ButtonLink href={`${url}&edit=1`} variant="outline">
                  ویرایش
                </ButtonLink>
              )}
              {statusActions[campaign.status].map((action) => (
                <Button
                  key={action}
                  variant={action === 'END' ? 'danger' : 'secondary'}
                  loading={pending === action}
                  disabled={
                    pending !== null ||
                    (campaign.budget.blockers.length > 0 &&
                      (action === 'APPROVE' || action === 'SCHEDULE' || action === 'RESUME'))
                  }
                  onClick={() => void transition(action)}
                >
                  {campaignActionLabels[action]}
                </Button>
              ))}
            </div>
          </div>
        )}
      </Card>

      <Card title="پیش‌نمایش بنر ذخیره‌شده">
        <CampaignPreview
          name={campaign.name}
          message={campaign.message}
          ctaLabel={campaign.ctaLabel}
          media={campaign.media}
        />
      </Card>

      <Card title="تاریخچهٔ نسخه‌ها">
        <ul className="divide-y divide-[var(--admin-color-border)] text-sm">
          {campaign.history.map(({ version, action, actorUserId, snapshot, recordedAt }) => (
            <li key={version} className="py-2">
              <details>
                <summary className="cursor-pointer font-medium">
                  نسخهٔ {formatAdminInteger(version)} · {historyLabels[action] ?? action} ·{' '}
                  {formatAdminDateTime(recordedAt)}
                </summary>
                <p className="my-2 text-xs">
                  اعمال‌کننده{' '}
                  {actorUserId ? <bdi className="font-mono">{actorUserId}</bdi> : 'زمان‌بند خودکار'}
                </p>
                <pre
                  dir="ltr"
                  className="max-h-64 overflow-auto rounded bg-[var(--admin-color-surface-subtle)] p-3 text-xs"
                >
                  {JSON.stringify(snapshot, null, 2)}
                </pre>
              </details>
            </li>
          ))}
        </ul>
        {campaign.historyPage > 1 || campaign.hasMoreHistory ? (
          <nav aria-label="صفحات تاریخچه" className="mt-4 flex flex-wrap gap-2">
            {campaign.historyPage > 1 && (
              <ButtonLink
                href={`${url}&history=${campaign.historyPage - 1}`}
                variant="outline"
                size="sm"
              >
                نسخه‌های جدیدتر
              </ButtonLink>
            )}
            {campaign.hasMoreHistory && campaign.historyPage < 10_000 && (
              <ButtonLink
                href={`${url}&history=${campaign.historyPage + 1}`}
                variant="outline"
                size="sm"
              >
                نسخه‌های قدیمی‌تر
              </ButtonLink>
            )}
          </nav>
        ) : null}
      </Card>
    </div>
  );
}
