import type { PublicCatalogMedia } from '@/lib/catalog/public-catalog';

type CatalogMediaProps = Readonly<{
  media: PublicCatalogMedia | null;
  alt: string;
  eager?: boolean;
}>;

export function CatalogMedia({ media, alt, eager = false }: CatalogMediaProps) {
  const accessibleAlt = media?.altText?.trim() || alt;

  if (!media?.url || !media.mimeType.startsWith('image/')) {
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
    // eslint-disable-next-line @next/next/no-img-element -- media URLs are runtime catalog data and cannot be statically allowlisted.
    <img
      src={media.url}
      alt={accessibleAlt}
      width={media.width ?? undefined}
      height={media.height ?? undefined}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      className="h-full w-full object-cover"
    />
  );
}
