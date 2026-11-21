'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { StorefrontImage } from '@/components/media/storefront-image';
import type { PublicCampaignBanner } from '@/lib/home/public-campaign-banner';

export function CampaignBanner({ banner }: { banner: PublicCampaignBanner }) {
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const endsAt = Date.parse(banner.endsAt);
    let timer: ReturnType<typeof setTimeout> | undefined;

    function scheduleExpiry() {
      clearTimeout(timer);
      const remaining = endsAt - Date.now();
      if (!Number.isFinite(endsAt) || remaining <= 0) {
        setExpired(true);
      } else {
        timer = setTimeout(scheduleExpiry, Math.min(remaining, 2_147_483_647));
      }
    }

    timer = setTimeout(scheduleExpiry, 0);
    window.addEventListener('pageshow', scheduleExpiry);
    document.addEventListener('visibilitychange', scheduleExpiry);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('pageshow', scheduleExpiry);
      document.removeEventListener('visibilitychange', scheduleExpiry);
    };
  }, [banner.endsAt]);

  if (expired) return null;

  return (
    <aside aria-label={banner.name} className="sf-container pt-6">
      <div className="flex flex-col items-start gap-4 rounded-sm border border-[var(--sf-color-border)] bg-[var(--sf-color-surface)] p-4 sm:flex-row sm:items-center sm:gap-6 sm:p-6">
        {banner.media?.url && (
          <StorefrontImage
            src={banner.media.url}
            alt={banner.media.altText ?? ''}
            width={120}
            height={80}
            sizes="120px"
            className="h-20 w-30 rounded-sm object-cover"
          />
        )}
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
