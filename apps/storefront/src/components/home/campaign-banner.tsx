'use client';

import Link from 'next/link';
import { CampaignArtwork } from '@/components/home/campaign-artwork';
import { useCampaignVisibility } from '@/lib/campaigns/campaign-visibility';
import type { PublicCampaignBanner } from '@/lib/home/public-campaign-banner';

export function CampaignBanner({
  banner,
  contained = true,
}: {
  banner: PublicCampaignBanner;
  contained?: boolean;
}) {
  const visible = useCampaignVisibility(banner.campaignId, banner.endsAt);
  if (!visible) return null;

  return (
    <aside aria-label={banner.name} className={contained ? 'sf-container pt-6' : 'mb-6'}>
      <div className="flex flex-col items-start gap-4 rounded-sm border border-[var(--sf-color-border)] bg-[var(--sf-color-surface)] p-4 sm:flex-row sm:items-center sm:gap-6 sm:p-6">
        <CampaignArtwork
          key={`${banner.media?.url}:${banner.mobileMedia?.url}:${banner.stillMedia?.url}`}
          artwork={banner}
          sizes="120px"
          className="relative h-20 w-30 shrink-0 overflow-hidden rounded-sm"
        />
        <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
          <p className="text-base font-semibold">{banner.name}</p>
          <p className="mt-1 whitespace-pre-line text-sm leading-7 text-[var(--sf-color-muted)]">
            {banner.message}
          </p>
        </div>
        {banner.ctaPath && banner.ctaLabel && (
          <Link
            className="max-w-full rounded-sm border border-current px-4 py-2 text-sm font-medium [overflow-wrap:anywhere] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
            href={banner.ctaPath}
          >
            {banner.ctaLabel}
          </Link>
        )}
      </div>
    </aside>
  );
}
