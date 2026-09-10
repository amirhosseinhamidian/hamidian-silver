import { describe, expect, it } from 'vitest';

import { buildStorefrontPageMetadata, buildStorefrontRootMetadata } from '@/lib/seo/metadata';
import type { PublicSiteSettings } from '@/lib/site-settings/public-site-settings';

const settings: PublicSiteSettings = {
  headerCategories: [],
  announcement: {
    enabled: false,
    message: null,
    countdownMode: 'NONE',
    durationSeconds: null,
    endsAt: null,
    ctaLabel: null,
    ctaHref: null,
  },
  catalogHeroEnabled: false,
  catalogHeroTitle: null,
  catalogHeroSubtitle: null,
  catalogHeroMedia: null,
  galleryName: null,
  footerAbout: null,
  contactAddress: null,
  contactPhoneNumbers: [],
  contactEmail: null,
  instagramUrl: null,
  telegramUrl: null,
  baleUrl: null,
  seoSiteName: 'گالری حمیدیان',
  seoDefaultTitle: 'نقره حمیدیان',
  seoTitleTemplate: '%s — گالری حمیدیان',
  seoDefaultDescription: 'توضیح پیش‌فرض',
  seoDefaultOgMedia: {
    url: 'https://media.example/default.webp',
    altText: 'نقره حمیدیان',
  },
  seoOrganizationName: 'گالری حمیدیان',
  seoOrganizationLogoMedia: null,
  seoSocialProfileUrls: [],
  seoHomeTitle: null,
  seoHomeDescription: null,
  seoHomeOgMedia: null,
};

const origin = new URL('https://silver.example');

describe('storefront metadata engine', () => {
  it('builds global title, description, Open Graph and Twitter defaults', () => {
    expect(buildStorefrontRootMetadata(settings, origin, 'search-console-token')).toMatchObject({
      metadataBase: origin,
      applicationName: 'گالری حمیدیان',
      title: {
        default: 'نقره حمیدیان',
        template: '%s — گالری حمیدیان',
      },
      description: 'توضیح پیش‌فرض',
      verification: { google: 'search-console-token' },
      openGraph: {
        locale: 'fa_IR',
        siteName: 'گالری حمیدیان',
        images: [{ url: 'https://media.example/default.webp' }],
      },
      twitter: { card: 'summary_large_image' },
    });
  });

  it('uses entity SEO overrides and its Open Graph image', () => {
    expect(
      buildStorefrontPageMetadata(
        settings,
        {
          pathname: '/products/silver-ring',
          title: 'انگشتر نقره',
          description: 'توضیح محصول',
          seoTitle: 'خرید انگشتر نقره',
          seoDescription: 'توضیح سئو',
          seoCanonicalPath: '/products/canonical-ring',
          seoOgMedia: {
            url: 'https://media.example/ring.webp',
            altText: 'انگشتر',
            width: 1200,
            height: 630,
          },
        },
        origin,
      ),
    ).toMatchObject({
      title: 'خرید انگشتر نقره',
      description: 'توضیح سئو',
      alternates: { canonical: new URL('https://silver.example/products/canonical-ring') },
      robots: { index: true, follow: true },
      openGraph: {
        title: 'خرید انگشتر نقره — گالری حمیدیان',
        images: [
          {
            url: 'https://media.example/ring.webp',
            alt: 'انگشتر',
            width: 1200,
            height: 630,
          },
        ],
      },
    });
  });

  it('canonicalizes and blocks filtered catalog variants while allowing crawlers to follow', () => {
    expect(
      buildStorefrontPageMetadata(
        settings,
        {
          pathname: '/products',
          searchParams: { q: 'انگشتر', sort: 'price-desc' },
          title: 'محصولات',
        },
        origin,
      ),
    ).toMatchObject({
      alternates: { canonical: new URL('https://silver.example/products') },
      robots: { index: false, follow: true },
    });
  });

  it('honors an entity no-index override on an otherwise public page', () => {
    expect(
      buildStorefrontPageMetadata(
        settings,
        {
          pathname: '/brands/example',
          title: 'برند نمونه',
          seoNoIndex: true,
        },
        origin,
      ).robots,
    ).toMatchObject({ index: false, follow: true });
  });
});
