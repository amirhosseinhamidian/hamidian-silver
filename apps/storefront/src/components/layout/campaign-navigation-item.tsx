'use client';

import { Close } from '@radix-ui/react-dialog';
import Link from 'next/link';
import { FiStar, FiTag } from 'react-icons/fi';
import { useCampaignVisibility } from '@/lib/campaigns/campaign-visibility';
import type { PublicCampaignBanner } from '@/lib/home/public-campaign-banner';
import { campaignPlacementMotion } from './campaign-placement-motion';

export function CampaignNavigationItem({
  campaign,
  mobile = false,
  preview = false,
}: {
  campaign: PublicCampaignBanner;
  mobile?: boolean;
  preview?: boolean;
}) {
  const visible = useCampaignVisibility(
    preview ? undefined : campaign.campaignId,
    preview ? undefined : campaign.endsAt,
  );
  if (!visible || !campaign.ctaPath) return null;

  const { display, navigationEffect: effect, textColor } = campaign;
  const gradientPreset = effect === 'GRADIENT' || effect === 'ANIMATED';
  const fill = display?.backgroundColor ?? (gradientPreset ? '#40303d' : 'var(--sf-color-ink)');
  const gradient =
    display?.gradientColor ?? (gradientPreset && !display?.backgroundColor ? '#6c414a' : undefined);
  const Icon = display?.icon === 'STAR' ? FiStar : display?.icon === 'TAG' ? FiTag : null;
  const motion = campaignPlacementMotion(
    display?.motion ?? (effect === 'ANIMATED' ? 'EMPHASIS' : undefined),
  );
  const link = (
    <Link
      href={campaign.ctaPath}
      prefetch={preview ? false : undefined}
      className={`inline-flex max-w-full items-center gap-1.5 rounded-sm border px-3 py-1.5 font-semibold leading-5 [overflow-wrap:anywhere] ${motion}`}
      style={{
        backgroundColor: fill,
        backgroundImage: gradient ? `linear-gradient(to left, ${fill}, ${gradient})` : undefined,
        color: textColor ?? '#ffffff',
        borderColor: display?.borderColor ?? 'transparent',
      }}
    >
      {Icon && <Icon aria-hidden="true" className="shrink-0" />}
      <span>{display?.title ?? campaign.name}</span>
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
