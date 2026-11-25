'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useCampaignVisibility } from '@/lib/campaigns/campaign-visibility';
import type { PublicCampaignBanner } from '@/lib/home/public-campaign-banner';

export function CampaignPlacementRollover({
  announcement,
  navigation,
}: {
  announcement?: PublicCampaignBanner | null;
  navigation?: PublicCampaignBanner | null;
}) {
  const router = useRouter();
  const announcementVisible = useCampaignVisibility(announcement?.campaignId, announcement?.endsAt);
  const navigationVisible = useCampaignVisibility(navigation?.campaignId, navigation?.endsAt);
  const invalid = [announcementVisible ? null : announcement, navigationVisible ? null : navigation]
    .flatMap((placement) =>
      placement ? [`${placement.campaignId ?? ''}:${placement.endsAt}`] : [],
    )
    .join('|');
  const lastRefresh = useRef('');

  useEffect(() => {
    if (lastRefresh.current === invalid) return;
    lastRefresh.current = invalid;
    if (invalid) router.refresh();
  }, [invalid, router]);

  return null;
}
