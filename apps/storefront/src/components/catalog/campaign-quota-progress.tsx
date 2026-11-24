'use client';

import type { components } from '@hamidian/contracts';
import { CampaignTag } from '@/components/catalog/campaign-tag';
import { useCampaignVisibility } from '@/lib/campaigns/campaign-visibility';

const number = new Intl.NumberFormat('fa-IR');

export function CampaignQuotaProgress({
  quota,
  showName = false,
}: {
  showName?: boolean;
  quota: components['schemas']['PublicCampaignQuotaDto'];
}) {
  const visible = useCampaignVisibility(quota.campaignId, quota.endsAt);
  if (!visible) return null;

  return (
    <div className="mt-3 space-y-1 text-start text-xs leading-5 text-[var(--sf-color-muted)]">
      {showName && <CampaignTag name={quota.name} />}
      <div className="flex flex-wrap justify-between gap-x-2">
        <span>{number.format(quota.sold)} فروش‌رفته</span>
        <span>
          {quota.remaining > 0
            ? `${number.format(quota.remaining)} باقی‌مانده`
            : 'سهمیهٔ کمپین در دسترس نیست'}
        </span>
      </div>
      <progress
        aria-label={`فروش سهمیهٔ ${quota.name}`}
        className="block h-1 w-full accent-[var(--sf-color-ink)]"
        value={quota.sold}
        max={quota.limit}
      />
    </div>
  );
}
