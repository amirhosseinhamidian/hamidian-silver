import type { PublicCatalogProductDetail } from '@/lib/catalog/public-catalog';
import { getStorefrontAbsoluteUrl, getStorefrontMetadataBase } from '@/lib/seo/metadata';
import type { PublicSiteSettings } from '@/lib/site-settings/public-site-settings';

export type StorefrontBreadcrumbItem = Readonly<{
  label: string;
  href: string;
}>;

export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function uniqueAbsoluteUrls(urls: Array<string | null | undefined>, metadataBase: URL): string[] {
  return [
    ...new Set(urls.flatMap((url) => (url ? [getStorefrontAbsoluteUrl(url, metadataBase)] : []))),
  ];
}

export function buildBreadcrumbStructuredData(
  items: readonly StorefrontBreadcrumbItem[],
  metadataBase: URL = getStorefrontMetadataBase(),
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.label,
      item: getStorefrontAbsoluteUrl(item.href, metadataBase),
    })),
  } as const;
}

export function buildProductStructuredData(
  product: PublicCatalogProductDetail,
  settings: PublicSiteSettings,
  metadataBase: URL = getStorefrontMetadataBase(),
) {
  const canonicalUrl = getStorefrontAbsoluteUrl(
    product.seoCanonicalPath?.trim() || `/products/${product.slug}`,
    metadataBase,
  );
  const images = uniqueAbsoluteUrls(
    [product.primaryMedia?.url, ...product.media.map((media) => media.url)],
    metadataBase,
  );
  const description =
    product.seoDescription?.trim() ||
    product.shortDescription?.trim() ||
    product.description?.trim();
  const organizationName =
    settings.seoOrganizationName?.trim() || settings.seoSiteName?.trim() || 'نقره حمیدیان';
  const priceRial = product.salePriceToman === null ? null : product.salePriceToman * 10;

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${canonicalUrl}#product`,
    url: canonicalUrl,
    name: product.name,
    productID: product.id,
    ...(description ? { description } : {}),
    ...(images.length ? { image: images } : {}),
    ...(product.brand
      ? {
          brand: {
            '@type': 'Brand',
            name: product.brand.name,
          },
        }
      : {}),
    ...(product.categories.length
      ? { category: product.categories.map((category) => category.name).join('، ') }
      : {}),
    ...(product.country
      ? {
          countryOfOrigin: {
            '@type': 'Country',
            name: product.country.name,
          },
        }
      : {}),
    ...(priceRial !== null
      ? {
          offers: {
            '@type': 'Offer',
            url: canonicalUrl,
            priceCurrency: 'IRR',
            price: priceRial,
            availability: product.isAvailable
              ? 'https://schema.org/InStock'
              : 'https://schema.org/OutOfStock',
            itemCondition: 'https://schema.org/NewCondition',
            seller: {
              '@type': 'Organization',
              name: organizationName,
            },
          },
        }
      : {}),
  } as const;
}
