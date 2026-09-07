import type { PublicCatalogMedia } from '@/lib/catalog/public-catalog';

type CatalogMediaProps = Readonly<{
  media: PublicCatalogMedia | null;
  alt: string;
  eager?: boolean;
  fallbackSrc?: string | null;
  imageClassName?: string;
}>;

export function CatalogMedia({
  media,
  alt,
  eager = false,
  fallbackSrc = null,
  imageClassName = 'object-cover',
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
    // eslint-disable-next-line @next/next/no-img-element -- media URLs are runtime catalog data and local dev fixtures are intentionally served from public/.
    <img
      src={src}
      alt={accessibleAlt}
      width={media?.width ?? undefined}
      height={media?.height ?? undefined}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      className={`h-full w-full ${imageClassName}`}
    />
  );
}
