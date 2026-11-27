import Image from 'next/image';

import type { CampaignMedia } from '@/lib/campaigns/campaign-model';

type Props = {
  name: string;
  message: string;
  ctaLabel?: string | null;
  media: CampaignMedia | null;
};

export function CampaignPreview({ name, message, ctaLabel, media }: Props) {
  return (
    <div className="flex flex-col items-start gap-4 rounded-lg border border-[var(--admin-color-border)] bg-[var(--admin-color-surface-subtle)] p-4 sm:flex-row sm:items-center">
      {media?.url && (
        <Image
          src={media.url}
          alt={media.altText ?? ''}
          width={120}
          height={80}
          unoptimized
          className="h-20 w-30 rounded object-cover"
        />
      )}
      <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
        <p className="font-bold">{name || 'نام کمپین'}</p>
        <p className="mt-1 whitespace-pre-line text-sm">{message || 'پیام کمپین'}</p>
      </div>
      {ctaLabel && (
        <span className="rounded border border-current px-3 py-2 text-sm">{ctaLabel}</span>
      )}
    </div>
  );
}
