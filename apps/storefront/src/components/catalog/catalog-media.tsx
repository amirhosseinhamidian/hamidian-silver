import { StorefrontImage } from '@/components/media/storefront-image';
import type { PublicCatalogMedia } from '@/lib/catalog/public-catalog';

type CatalogMediaProps = Readonly<{
  media: PublicCatalogMedia | null;
  alt: string;
  eager?: boolean;
  fetchPriority?: 'auto' | 'high' | 'low';
  fallbackSrc?: string | null;
  imageClassName?: string;
  preload?: boolean;
  sizes?: string;
}>;

const DEFAULT_IMAGE_DIMENSION = 1_200;

function imageDimension(value: number | null | undefined): number {
  return value && value > 0 ? value : DEFAULT_IMAGE_DIMENSION;
}

export function CatalogMedia({
  media,
  alt,
  eager = false,
  fetchPriority,
  fallbackSrc = null,
  imageClassName = 'object-cover',
  preload = false,
  sizes = '100vw',
}: CatalogMediaProps) {
  const accessibleAlt = media?.altText?.trim() || alt;
  const src =
    media?.url && media.mimeType.startsWith('image/') ? media.url : fallbackSrc?.trim() || null;

  if (!src) {
    return (
      <span
        className="
          flex h-full w-full items-center justify-center px-6 text-center
          text-xs leading-6 text-[var(--sf-color-subtle)]
        "
      >
        {accessibleAlt}
      </span>
    );
  }

  return (
    <StorefrontImage
      src={src}
      alt={accessibleAlt}
      width={imageDimension(media?.width)}
      height={imageDimension(media?.height)}
      sizes={sizes}
      preload={preload}
      fetchPriority={fetchPriority}
      loading={preload ? undefined : eager ? 'eager' : 'lazy'}
      decoding="async"
      className={`h-full w-full ${imageClassName}`}
    />
  );
}
