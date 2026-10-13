import type { PublicCatalogProductDetail } from '@/lib/catalog/public-catalog';
import { STOREFRONT_BRAND_NAME } from '@/lib/brand/identity';
import type {
  PublicGuideArticle,
  PublicGuideArticleList,
  PublicGuideArticleSummary,
} from '@/lib/guide/public-guide';
import { getStorefrontAbsoluteUrl, getStorefrontMetadataBase } from '@/lib/seo/metadata';
import type { PublicShippingOption } from '@/lib/shipping/public-shipping-pricing';
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

function uniqueHttpUrls(urls: Array<string | null | undefined>): string[] {
  const values = urls.flatMap((value) => {
    if (!value?.trim()) return [];
    try {
      const url = new URL(value.trim());
      return url.protocol === 'http:' || url.protocol === 'https:' ? [url.href] : [];
    } catch {
      return [];
    }
  });
  return [...new Set(values)];
}

function organizationName(settings: PublicSiteSettings): string {
  return (
    settings.seoOrganizationName?.trim() || settings.seoSiteName?.trim() || STOREFRONT_BRAND_NAME
  );
}

function organizationId(metadataBase: URL): string {
  return `${getStorefrontAbsoluteUrl('/', metadataBase)}#organization`;
}

export function buildWebSiteStructuredData(
  settings: PublicSiteSettings,
  metadataBase: URL = getStorefrontMetadataBase(),
) {
  const url = getStorefrontAbsoluteUrl('/', metadataBase);
  const name = settings.seoSiteName?.trim() || STOREFRONT_BRAND_NAME;

  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${url}#website`,
    url,
    name,
    alternateName: metadataBase.hostname.toLowerCase(),
    publisher: { '@id': organizationId(metadataBase) },
    inLanguage: 'fa-IR',
  } as const;
}

function tomanToRial(value: number): number {
  return value * 10;
}

function buildShippingConditions(option: PublicShippingOption) {
  if (option.serviceArea !== 'NATIONWIDE' || option.pricingMode === 'COLLECT') return [];

  const destination = {
    '@type': 'DefinedRegion',
    addressCountry: 'IR',
  } as const;
  const shippingRate = (valueToman: number) => ({
    '@type': 'MonetaryAmount',
    value: tomanToRial(valueToman),
    currency: 'IRR',
  });

  if (option.pricingMode === 'FREE') {
    return [
      {
        '@type': 'ShippingConditions',
        shippingDestination: destination,
        shippingRate: shippingRate(0),
      },
    ];
  }

  if (option.thresholdToman === null || option.discountedCostToman === null) {
    return [
      {
        '@type': 'ShippingConditions',
        shippingDestination: destination,
        shippingRate: shippingRate(option.baseCostToman),
      },
    ];
  }

  const thresholdRial = tomanToRial(option.thresholdToman);
  return [
    {
      '@type': 'ShippingConditions',
      shippingDestination: destination,
      orderValue: {
        '@type': 'MonetaryAmount',
        minValue: 0,
        maxValue: Math.max(0, thresholdRial - 1),
        currency: 'IRR',
      },
      shippingRate: shippingRate(option.baseCostToman),
    },
    {
      '@type': 'ShippingConditions',
      shippingDestination: destination,
      orderValue: {
        '@type': 'MonetaryAmount',
        minValue: thresholdRial,
        currency: 'IRR',
      },
      shippingRate: shippingRate(option.discountedCostToman),
    },
  ];
}

function buildShippingServices(
  options: readonly PublicShippingOption[],
  metadataBase: URL,
): unknown[] {
  const siteUrl = getStorefrontAbsoluteUrl('/', metadataBase);
  return options.flatMap((option) => {
    const shippingConditions = buildShippingConditions(option);
    if (shippingConditions.length === 0) return [];

    return [
      {
        '@type': 'ShippingService',
        '@id': `${siteUrl}#shipping-${option.id}`,
        name: option.name,
        ...(option.subtitle?.trim() ? { description: option.subtitle.trim() } : {}),
        fulfillmentType: 'https://schema.org/FulfillmentTypeDelivery',
        shippingConditions,
      },
    ];
  });
}

export function buildOrganizationStructuredData(
  settings: PublicSiteSettings,
  shippingOptions: readonly PublicShippingOption[] = [],
  metadataBase: URL = getStorefrontMetadataBase(),
) {
  const url = getStorefrontAbsoluteUrl('/', metadataBase);
  const logoUrl = settings.seoOrganizationLogoMedia?.url
    ? getStorefrontAbsoluteUrl(settings.seoOrganizationLogoMedia.url, metadataBase)
    : null;
  const sameAs = uniqueHttpUrls([
    ...(settings.seoSocialProfileUrls ?? []),
    settings.instagramUrl,
    settings.telegramUrl,
    settings.baleUrl,
  ]);
  const shippingServices = buildShippingServices(shippingOptions, metadataBase);
  const contactEmail = settings.contactEmail?.trim() || null;
  const contactPhone = settings.contactPhoneNumbers.find((phone) => phone.trim())?.trim() || null;

  return {
    '@context': 'https://schema.org',
    '@type': 'OnlineStore',
    '@id': organizationId(metadataBase),
    url,
    name: organizationName(settings),
    ...(settings.seoDefaultDescription?.trim()
      ? { description: settings.seoDefaultDescription.trim() }
      : {}),
    ...(logoUrl
      ? {
          logo: {
            '@type': 'ImageObject',
            url: logoUrl,
          },
        }
      : {}),
    ...(sameAs.length ? { sameAs } : {}),
    ...(contactEmail || contactPhone
      ? {
          contactPoint: {
            '@type': 'ContactPoint',
            contactType: 'customer service',
            ...(contactEmail ? { email: contactEmail } : {}),
            ...(contactPhone ? { telephone: contactPhone } : {}),
          },
        }
      : {}),
    hasMerchantReturnPolicy: {
      '@type': 'MerchantReturnPolicy',
      merchantReturnLink: getStorefrontAbsoluteUrl('/faq#return-policy', metadataBase),
    },
    ...(shippingServices.length ? { hasShippingService: shippingServices } : {}),
  } as const;
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

function guideCanonicalPath(
  article: Pick<PublicGuideArticleSummary, 'seoCanonicalPath' | 'slug'>,
): string {
  const fallback = `/guide/${article.slug}`;
  const candidate = article.seoCanonicalPath?.trim();
  return candidate && /^\/guide\/(?!\.{1,2}$)[^%\\/?#\s]+$/.test(candidate) ? candidate : fallback;
}

export function buildGuideArticleStructuredData(
  article: PublicGuideArticle,
  settings: PublicSiteSettings,
  metadataBase: URL = getStorefrontMetadataBase(),
) {
  const canonicalUrl = getStorefrontAbsoluteUrl(guideCanonicalPath(article), metadataBase);
  const imageUrl = article.seoOgMedia?.url || article.heroMedia?.url;
  const guideUrl = getStorefrontAbsoluteUrl('/guide', metadataBase);
  const about = [
    ...article.topics.map((topic) => ({ '@type': 'Thing', name: topic.name })),
    ...article.relatedCategories.map((category) => ({
      '@type': 'CollectionPage',
      name: category.name,
      url: getStorefrontAbsoluteUrl(`/categories/${category.slug}`, metadataBase),
    })),
    ...article.relatedBrands.map((brand) => ({
      '@type': 'Brand',
      name: brand.name,
      url: getStorefrontAbsoluteUrl(`/brands/${brand.slug}`, metadataBase),
    })),
    ...article.relatedProducts.map((product) => ({
      '@type': 'Product',
      name: product.name,
      url: getStorefrontAbsoluteUrl(`/products/${product.slug}`, metadataBase),
    })),
  ];
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    '@id': `${canonicalUrl}#article`,
    url: canonicalUrl,
    mainEntityOfPage: canonicalUrl,
    inLanguage: 'fa-IR',
    isPartOf: {
      '@type': 'CollectionPage',
      '@id': `${guideUrl}#collection`,
      url: guideUrl,
      name: 'دانستنی‌ها',
    },
    headline: article.seoTitle?.trim() || article.title,
    ...(article.seoDescription?.trim() || article.excerpt?.trim()
      ? { description: article.seoDescription?.trim() || article.excerpt?.trim() }
      : {}),
    ...(imageUrl ? { image: [getStorefrontAbsoluteUrl(imageUrl, metadataBase)] } : {}),
    ...(article.publishedAt ? { datePublished: article.publishedAt } : {}),
    dateModified: article.updatedAt,
    author: {
      '@type': 'Organization',
      '@id': organizationId(metadataBase),
      name: organizationName(settings),
    },
    publisher: {
      '@type': 'Organization',
      '@id': organizationId(metadataBase),
      name: organizationName(settings),
    },
    ...(article.searchKeywords.length ? { keywords: article.searchKeywords } : {}),
    ...(article.readingTimeMinutes ? { timeRequired: `PT${article.readingTimeMinutes}M` } : {}),
    ...(about.length ? { about } : {}),
    ...(article.topics.length ? { articleSection: article.topics.map((topic) => topic.name) } : {}),
  } as const;
}

export function buildGuideCollectionStructuredData(
  articles: PublicGuideArticleList,
  metadataBase: URL = getStorefrontMetadataBase(),
) {
  const url = getStorefrontAbsoluteUrl('/guide', metadataBase);
  const offset = (articles.page - 1) * articles.limit;
  const items = articles.items.filter((article) => !article.seoNoIndex);
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${url}#collection`,
    url,
    name: 'دانستنی‌ها',
    description: 'پاسخ پرسش‌ها و راهنماهای کاربردی برای شناخت، انتخاب، خرید و نگهداری محصولات.',
    inLanguage: 'fa-IR',
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: items.length,
      itemListElement: items.map((article, index) => {
        const articleUrl = getStorefrontAbsoluteUrl(guideCanonicalPath(article), metadataBase);
        const imageUrl = article.seoOgMedia?.url || article.heroMedia?.url;
        return {
          '@type': 'ListItem',
          position: offset + index + 1,
          item: {
            '@type': 'Article',
            '@id': `${articleUrl}#article`,
            url: articleUrl,
            headline: article.title,
            ...(imageUrl ? { image: getStorefrontAbsoluteUrl(imageUrl, metadataBase) } : {}),
          },
        };
      }),
    },
  } as const;
}

export function buildGuideFaqStructuredData(article: PublicGuideArticle) {
  const questions = article.blocks.flatMap((block) => {
    if (block.type !== 'FAQ' || !Array.isArray(block.content.items)) return [];
    return block.content.items.flatMap((value) => {
      if (typeof value !== 'object' || value === null) return [];
      const item = value as Record<string, unknown>;
      const question = typeof item.question === 'string' ? item.question.trim() : '';
      const answer = typeof item.answer === 'string' ? item.answer.trim() : '';
      return question && answer ? [{ question, answer }] : [];
    });
  });
  if (!questions.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: questions.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: answer },
    })),
  } as const;
}

function productDescription(product: PublicCatalogProductDetail): string | undefined {
  return (
    product.seoDescription?.trim() ||
    product.shortDescription?.trim() ||
    product.description?.trim() ||
    undefined
  );
}

function productImages(product: PublicCatalogProductDetail, metadataBase: URL): string[] {
  return uniqueAbsoluteUrls(
    [product.primaryMedia?.url, ...product.media.map((media) => media.url)],
    metadataBase,
  );
}

function productCommonData(product: PublicCatalogProductDetail) {
  return {
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
  } as const;
}

function buildOffer(
  canonicalUrl: string,
  salePriceToman: number | null,
  isAvailable: boolean,
  settings: PublicSiteSettings,
  metadataBase: URL,
) {
  if (salePriceToman === null) return undefined;

  return {
    '@type': 'Offer',
    url: canonicalUrl,
    priceCurrency: 'IRR',
    price: tomanToRial(salePriceToman),
    availability: isAvailable ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    itemCondition: 'https://schema.org/NewCondition',
    seller: {
      '@type': 'OnlineStore',
      '@id': organizationId(metadataBase),
      name: organizationName(settings),
    },
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
  const images = productImages(product, metadataBase);
  const description = productDescription(product);
  const commonData = productCommonData(product);

  if (product.variants.length > 1) {
    const groupId = `${canonicalUrl}#product-group`;
    const hasSizedVariants = product.variants.some((variant) => Boolean(variant.size?.label));

    return {
      '@context': 'https://schema.org',
      '@type': 'ProductGroup',
      '@id': groupId,
      url: canonicalUrl,
      name: product.name,
      productGroupID: product.id,
      ...(description ? { description } : {}),
      ...(images.length ? { image: images } : {}),
      ...commonData,
      ...(hasSizedVariants ? { variesBy: ['https://schema.org/size'] } : {}),
      hasVariant: product.variants.map((variant) => {
        const variantLabel = variant.size?.label?.trim() || variant.name?.trim() || null;
        const offer = buildOffer(
          canonicalUrl,
          variant.salePriceToman,
          variant.isAvailable,
          settings,
          metadataBase,
        );

        return {
          '@type': 'Product',
          '@id': `${canonicalUrl}#variant-${variant.id}`,
          name: variantLabel ? `${product.name} - ${variantLabel}` : product.name,
          productID: variant.id,
          sku: variant.sku,
          ...(description ? { description } : {}),
          ...(images.length ? { image: images } : {}),
          ...(variant.size?.label?.trim() ? { size: variant.size.label.trim() } : {}),
          ...(offer ? { offers: offer } : {}),
        };
      }),
    } as const;
  }

  const onlyVariant = product.variants[0];
  const offer = buildOffer(
    canonicalUrl,
    onlyVariant?.salePriceToman ?? product.salePriceToman,
    onlyVariant?.isAvailable ?? product.isAvailable,
    settings,
    metadataBase,
  );

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${canonicalUrl}#product`,
    url: canonicalUrl,
    name: product.name,
    productID: product.id,
    ...(onlyVariant?.sku ? { sku: onlyVariant.sku } : {}),
    ...(description ? { description } : {}),
    ...(images.length ? { image: images } : {}),
    ...commonData,
    ...(offer ? { offers: offer } : {}),
  } as const;
}
