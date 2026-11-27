import type { PublicCampaignBanner } from '@/lib/home/public-campaign-banner';

export function campaignPlacementMotion(
  motion: NonNullable<PublicCampaignBanner['display']>['motion'],
) {
  if (motion === 'SUBTLE') {
    return '[--sf-campaign-pulse-width:1px] motion-safe:animate-[sf-campaign-link_1.4s_ease-in-out_1]';
  }
  if (motion === 'EMPHASIS') return 'motion-safe:animate-[sf-campaign-link_1.4s_ease-in-out_2]';
  return '';
}
