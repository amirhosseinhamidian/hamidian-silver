'use client';

import type { components } from '@hamidian/contracts';
import { useCampaignExpiration } from '@/components/catalog/use-campaign-expiration';

const number = new Intl.NumberFormat('fa-IR');

export function CampaignQuotaProgress({
  quota,
}: {
  quota: components['schemas']['PublicCampaignQuotaDto'];
}) {
  const expired = useCampaignExpiration(quota.endsAt);
  if (expired) return null;

  return (
    <div className="mt-3 space-y-1 text-start text-xs leading-5 text-[var(--sf-color-muted)]">
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
