import type { PublicCatalogMedia } from '@/lib/catalog/public-catalog';

export type WishlistItem = Readonly<{
  productId: string;
  slug: string;
  name: string;
  brandName: string | null;
  media: PublicCatalogMedia | null;
  salePriceToman: number | null;
  compareAtPriceToman: number | null;
}>;

const MAX_WISHLIST_ITEMS = 100;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isNullableSafeInteger(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0);
}

function normalizeMedia(value: unknown): PublicCatalogMedia | null | undefined {
  if (value === null) {
    return null;
  }

  if (
    !isRecord(value) ||
    !isNullableString(value.url) ||
    typeof value.mimeType !== 'string' ||
    !value.mimeType ||
    !isNullableString(value.altText) ||
    !isNullableSafeInteger(value.width) ||
    !isNullableSafeInteger(value.height)
  ) {
    return undefined;
  }

  return {
    url: value.url,
    mimeType: value.mimeType,
    altText: value.altText,
    width: value.width,
    height: value.height,
  };
}

function normalizeWishlistItem(value: unknown): WishlistItem | null {
  if (!isRecord(value)) {
    return null;
  }

  const media = normalizeMedia(value.media);
  const compareAtPriceToman =
    value.compareAtPriceToman === undefined ? null : value.compareAtPriceToman;

  if (
    typeof value.productId !== 'string' ||
    !value.productId ||
    typeof value.slug !== 'string' ||
    !value.slug ||
    typeof value.name !== 'string' ||
    !value.name ||
    !isNullableString(value.brandName) ||
    media === undefined ||
    !isNullableSafeInteger(value.salePriceToman) ||
    !isNullableSafeInteger(compareAtPriceToman)
  ) {
    return null;
  }

  return {
    productId: value.productId,
    slug: value.slug,
    name: value.name,
    brandName: value.brandName,
    media,
    salePriceToman: value.salePriceToman,
    compareAtPriceToman,
  };
}

export function toggleWishlistItem(
  items: readonly WishlistItem[],
  item: WishlistItem,
): readonly WishlistItem[] {
  if (items.some((existing) => existing.productId === item.productId)) {
    return items.filter((existing) => existing.productId !== item.productId);
  }

  return [item, ...items].slice(0, MAX_WISHLIST_ITEMS);
}

export function isWishlistItem(items: readonly WishlistItem[], productId: string): boolean {
  return items.some((item) => item.productId === productId);
}

export function serializeWishlist(items: readonly WishlistItem[]): string {
  return JSON.stringify(items);
}

export function deserializeWishlist(serialized: string | null): readonly WishlistItem[] {
  if (!serialized) {
    return [];
  }

  try {
    const value: unknown = JSON.parse(serialized);

    if (!Array.isArray(value)) {
      return [];
    }

    const items = value
      .slice(0, MAX_WISHLIST_ITEMS)
      .map(normalizeWishlistItem)
      .filter((item): item is WishlistItem => item !== null);
    const unique = new Map(items.map((item) => [item.productId, item]));

    return [...unique.values()];
  } catch {
    return [];
  }
}
