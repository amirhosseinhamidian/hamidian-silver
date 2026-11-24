'use client';

import { Close } from '@radix-ui/react-dialog';
import Link from 'next/link';
import { useCampaignVisibility } from '@/lib/campaigns/campaign-visibility';
import type { PublicCampaignBanner } from '@/lib/home/public-campaign-banner';

export function CampaignNavigationItem({
  campaign,
  mobile = false,
}: {
  campaign: PublicCampaignBanner;
  mobile?: boolean;
}) {
  const visible = useCampaignVisibility(campaign.campaignId, campaign.endsAt);
  if (!visible || !campaign.ctaPath) return null;

  const effect = campaign.navigationEffect;
  const link = (
    <Link
      href={campaign.ctaPath}
      className={[
        'inline-flex max-w-full rounded-sm px-3 py-1.5 font-semibold leading-5 text-white [overflow-wrap:anywhere]',
        effect === 'GRADIENT' || effect === 'ANIMATED'
          ? 'bg-linear-to-l from-[#40303d] to-[#6c414a]'
          : 'bg-[var(--sf-color-ink)]',
        effect === 'ANIMATED' ? 'motion-safe:animate-[sf-campaign-link_1.4s_ease-in-out_2]' : '',
      ].join(' ')}
    >
      {campaign.name}
    </Link>
  );

  return mobile ? (
    <li className="py-3">
      <Close asChild>{link}</Close>
    </li>
  ) : (
    <li>{link}</li>
  );
}
