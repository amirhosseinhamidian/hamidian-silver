import { describe, expect, it } from 'vitest';

import type { PublicCatalogProductDetail } from '@/lib/catalog/public-catalog';
import {
  buildBreadcrumbStructuredData,
  buildOrganizationStructuredData,
  buildProductStructuredData,
  serializeJsonLd,
} from '@/lib/seo/structured-data';
import type { PublicSiteSettings } from '@/lib/site-settings/public-site-settings';

const origin = new URL('https://silver.example');
const settings = {
  seoOrganizationName: 'گالری حمیدیان',
} as PublicSiteSettings;

const product = {
  id: '10000000-0000-4000-8000-000000000010',
  name: 'انگشتر نقره',
  slug: 'silver-ring',
  shortDescription: 'انگشتر نقره دست‌ساز',
  description: null,
  seoDescription: 'انگشتر نقره خاص',
  seoCanonicalPath: '/products/ring-canonical',
  salePriceToman: 800_000,
  compareAtPriceToman: 1_000_000,
  sizeMode: 'SIZED',
  brand: {
    id: 'brand-1',
    name: 'برند نمونه',
    slug: 'sample-brand',
    description: null,
    image: null,
    originCountry: null,
  },
  categories: [
    {
      id: 'category-1',
      name: 'انگشتر',
      slug: 'rings',
      description: null,
      parentId: null,
      sortOrder: 1,
      image: null,
    },
  ],
  primaryMedia: {
    url: '/media/ring.webp',
    mimeType: 'image/webp',
    altText: 'انگشتر نقره',
    width: 1200,
    height: 1200,
  },
  availableQuantity: 2,
  isAvailable: true,
  country: { id: 'country-1', name: 'ایران', slug: 'iran', isoCode: 'IR' },
  media: [
    {
      url: '/media/ring.webp',
      mimeType: 'image/webp',
      altText: 'انگشتر نقره',
      width: 1200,
      height: 1200,
    },
  ],
  attributes: [],
  variants: [],
} satisfies PublicCatalogProductDetail;

describe('storefront structured data', () => {
  it('builds a canonical Product offer using IRR instead of toman', () => {
    expect(buildProductStructuredData(product, settings, origin)).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'Product',
      '@id': 'https://silver.example/products/ring-canonical#product',
      url: 'https://silver.example/products/ring-canonical',
      name: 'انگشتر نقره',
      description: 'انگشتر نقره خاص',
      image: ['https://silver.example/media/ring.webp'],
      brand: { '@type': 'Brand', name: 'برند نمونه' },
      countryOfOrigin: { '@type': 'Country', name: 'ایران' },
      offers: {
        '@type': 'Offer',
        priceCurrency: 'IRR',
        price: 8_000_000,
        availability: 'https://schema.org/InStock',
        itemCondition: 'https://schema.org/NewCondition',
        seller: {
          '@type': 'OnlineStore',
          '@id': 'https://silver.example/#organization',
          name: 'گالری حمیدیان',
        },
      },
    });
  });

  it('builds ProductGroup markup with public SKU and sized variants', () => {
    const variantProduct = {
      ...product,
      variants: [
        {
          id: 'variant-1',
          sku: 'RING-50',
          name: null,
          weightGrams: 4.1,
          salePriceToman: 800_000,
          compareAtPriceToman: null,
          size: {
            id: 'size-50',
            code: '50',
            label: '50',
            group: {
              id: 'ring-size',
              code: 'RING',
              name: 'سایز انگشتر',
              selectionLabel: 'انتخاب سایز',
              cartLabel: 'سایز',
            },
          },
          availableQuantity: 1,
          isAvailable: true,
          platingOptions: [],
        },
        {
          id: 'variant-2',
          sku: 'RING-52',
          name: null,
          weightGrams: 4.2,
          salePriceToman: 820_000,
          compareAtPriceToman: null,
          size: {
            id: 'size-52',
            code: '52',
            label: '52',
            group: {
              id: 'ring-size',
              code: 'RING',
              name: 'سایز انگشتر',
              selectionLabel: 'انتخاب سایز',
              cartLabel: 'سایز',
            },
          },
          availableQuantity: 0,
          isAvailable: false,
          platingOptions: [],
        },
      ],
    } satisfies PublicCatalogProductDetail;

    expect(buildProductStructuredData(variantProduct, settings, origin)).toMatchObject({
      '@type': 'ProductGroup',
      productGroupID: product.id,
      variesBy: ['https://schema.org/size'],
      hasVariant: [
        {
          '@type': 'Product',
          productID: 'variant-1',
          sku: 'RING-50',
          description: 'انگشتر نقره خاص',
          image: ['https://silver.example/media/ring.webp'],
          size: '50',
          offers: {
            priceCurrency: 'IRR',
            price: 8_000_000,
            availability: 'https://schema.org/InStock',
          },
        },
        {
          '@type': 'Product',
          productID: 'variant-2',
          sku: 'RING-52',
          description: 'انگشتر نقره خاص',
          image: ['https://silver.example/media/ring.webp'],
          size: '52',
          offers: {
            priceCurrency: 'IRR',
            price: 8_200_000,
            availability: 'https://schema.org/OutOfStock',
          },
        },
      ],
    });
  });

  it('builds OnlineStore policy markup from real public settings', () => {
    const organizationSettings = {
      seoOrganizationName: 'گالری حمیدیان',
      seoDefaultDescription: 'فروشگاه آنلاین نقره گالری حمیدیان',
      seoOrganizationLogoMedia: {
        url: '/media/logo.webp',
        altText: 'گالری حمیدیان',
      },
      seoSocialProfileUrls: ['https://instagram.com/hamidian'],
      instagramUrl: 'https://instagram.com/hamidian',
      telegramUrl: null,
      baleUrl: null,
      contactEmail: 'support@hamidian.test',
      contactPhoneNumbers: ['+982112345678'],
    } as PublicSiteSettings;

    expect(
      buildOrganizationStructuredData(
        organizationSettings,
        [
          {
            id: 'post',
            name: 'پست',
            subtitle: 'ارسال سراسری',
            logo: null,
            pricingMode: 'FIXED',
            baseCostToman: 100_000,
            thresholdToman: 5_000_000,
            discountedCostToman: 0,
            serviceArea: 'NATIONWIDE',
          },
          {
            id: 'tehran',
            name: 'پیک تهران',
            subtitle: null,
            logo: null,
            pricingMode: 'FIXED',
            baseCostToman: 80_000,
            thresholdToman: null,
            discountedCostToman: null,
            serviceArea: 'TEHRAN_ONLY',
          },
        ],
        origin,
      ),
    ).toMatchObject({
      '@type': 'OnlineStore',
      '@id': 'https://silver.example/#organization',
      url: 'https://silver.example/',
      name: 'گالری حمیدیان',
      logo: { '@type': 'ImageObject', url: 'https://silver.example/media/logo.webp' },
      sameAs: ['https://instagram.com/hamidian'],
      contactPoint: {
        '@type': 'ContactPoint',
        email: 'support@hamidian.test',
        telephone: '+982112345678',
      },
      hasMerchantReturnPolicy: {
        '@type': 'MerchantReturnPolicy',
        merchantReturnLink: 'https://silver.example/faq#return-policy',
      },
      hasShippingService: [
        {
          '@type': 'ShippingService',
          name: 'پست',
          shippingConditions: [
            {
              shippingDestination: { addressCountry: 'IR' },
              orderValue: { maxValue: 49_999_999, currency: 'IRR' },
              shippingRate: { value: 1_000_000, currency: 'IRR' },
            },
            {
              shippingDestination: { addressCountry: 'IR' },
              orderValue: { minValue: 50_000_000, currency: 'IRR' },
              shippingRate: { value: 0, currency: 'IRR' },
            },
          ],
        },
      ],
    });
  });

  it('builds ordered absolute breadcrumb items', () => {
    expect(
      buildBreadcrumbStructuredData(
        [
          { label: 'خانه', href: '/' },
          { label: 'محصولات', href: '/products' },
        ],
        origin,
      ),
    ).toMatchObject({
      '@type': 'BreadcrumbList',
      itemListElement: [
        { position: 1, name: 'خانه', item: 'https://silver.example/' },
        { position: 2, name: 'محصولات', item: 'https://silver.example/products' },
      ],
    });
  });

  it('escapes markup that could terminate a JSON-LD script', () => {
    expect(serializeJsonLd({ name: '</script><script>alert(1)</script>' })).not.toContain(
      '</script>',
    );
  });
});
