import { describe, expect, it } from 'vitest';

import type { PublicCatalogProductDetail } from '@/lib/catalog/public-catalog';
import {
  buildBreadcrumbStructuredData,
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
        seller: { '@type': 'Organization', name: 'گالری حمیدیان' },
      },
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
