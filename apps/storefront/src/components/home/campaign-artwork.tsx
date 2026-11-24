'use client';

import { useState } from 'react';
import { StorefrontImage } from '@/components/media/storefront-image';
import type { PublicCampaignBanner } from '@/lib/home/public-campaign-banner';

type Artwork = Pick<PublicCampaignBanner, 'media' | 'mobileMedia' | 'stillMedia'>;

export function CampaignArtwork({
  artwork,
  className,
  sizes,
}: {
  artwork: Artwork;
  className: string;
  sizes: string;
}) {
  const [playing, setPlaying] = useState(true);
  const [failed, setFailed] = useState(false);
  const { media, mobileMedia, stillMedia } = artwork;
  const animated = [media, mobileMedia].some(
    (asset) => asset?.url && asset.mimeType === 'image/gif',
  );
  const poster = [media, mobileMedia, stillMedia].find(
    (asset) => asset?.url && asset.mimeType !== 'image/gif',
  );
  const fallback = (failed || !playing ? stillMedia?.url : null) || poster?.url;
  if (!fallback) return null;

  return (
    <div className={className}>
      <picture className="absolute inset-0">
        {!failed &&
          playing &&
          mobileMedia?.url &&
          (mobileMedia.mimeType !== 'image/gif' || stillMedia?.url) && (
            <source
              media={
                mobileMedia.mimeType === 'image/gif'
                  ? '(max-width: 639px) and (prefers-reduced-motion: no-preference)'
                  : '(max-width: 639px)'
              }
              srcSet={mobileMedia.url}
            />
          )}
        {!failed &&
          playing &&
          media?.url &&
          (media.mimeType === 'image/gif' ? (
            stillMedia?.url && (
              <source media="(prefers-reduced-motion: no-preference)" srcSet={media.url} />
            )
          ) : (
            <source media="(min-width: 640px)" srcSet={media.url} />
          ))}
        <StorefrontImage
          src={fallback}
          alt={
            (playing && !failed ? media?.altText || mobileMedia?.altText : stillMedia?.altText) ||
            poster?.altText ||
            ''
          }
          fill
          unoptimized
          sizes={sizes}
          className="object-cover"
          onError={() => setFailed(true)}
        />
      </picture>
      {animated && stillMedia?.url && !failed && (
        <button
          type="button"
          className="absolute bottom-1 end-1 z-10 grid size-8 place-items-center rounded-sm bg-black text-white focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:hidden"
          aria-label={playing ? 'توقف پخش تصویر کمپین' : 'پخش تصویر کمپین'}
          onClick={() => setPlaying((current) => !current)}
        >
          <span aria-hidden="true">{playing ? 'Ⅱ' : '▶'}</span>
        </button>
      )}
    </div>
  );
}
