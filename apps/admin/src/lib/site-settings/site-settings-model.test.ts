import { describe, expect, it } from 'vitest';

import {
  parseAdminHomepageSettings,
  parseAdminSiteSettings,
  parseCategoryReferences,
  parseCountryReferences,
  parseProductReferences,
} from '@/lib/site-settings/site-settings-model';

const announcement = {
  enabled: true,
  message: 'ارسال رایگان',
  countdownMode: 'NONE',
  durationSeconds: null,
  endsAt: null,
  ctaLabel: 'مشاهده',
  ctaHref: '/products',
};

describe('site settings model', () => {
  it('parses general site, header, announcement and contact settings', () => {
    const result = parseAdminSiteSettings({
      headerCategoryIds: ['category-1'],
      announcement,
      catalogHeroEnabled: false,
      catalogHeroTitle: null,
      catalogHeroSubtitle: null,
      catalogHeroMediaId: null,
      catalogHeroMedia: null,
      galleryName: 'گالری حمیدیان',
      footerAbout: 'زیورآلات نقره',
      contactAddress: 'تهران',
      contactPhoneNumbers: ['02112345678'],
      contactEmail: 'hello@example.com',
      instagramUrl: null,
      telegramUrl: null,
      baleUrl: null,
      seoSiteName: 'نقره حمیدیان',
      seoDefaultTitle: 'فروشگاه نقره حمیدیان',
      seoTitleTemplate: '%s | نقره حمیدیان',
      seoDefaultDescription: 'خرید آنلاین نقره',
      seoDefaultOgMediaId: null,
      seoDefaultOgMedia: null,
      seoOrganizationName: 'گالری نقره حمیدیان',
      seoOrganizationLogoMediaId: null,
      seoOrganizationLogoMedia: null,
      seoSocialProfileUrls: ['https://instagram.com/hamidian'],
      seoHomeTitle: null,
      seoHomeDescription: null,
      seoHomeOgMediaId: null,
      seoHomeOgMedia: null,
      updatedAt: '2026-09-08T12:00:00.000Z',
    });

    expect(result).toMatchObject({
      headerCategoryIds: ['category-1'],
      announcement: { message: 'ارسال رایگان' },
      galleryName: 'گالری حمیدیان',
    });
  });

  it('rejects malformed announcement data', () => {
    expect(
      parseAdminSiteSettings({
        headerCategoryIds: [],
        announcement: { ...announcement, countdownMode: 'UNKNOWN' },
        contactPhoneNumbers: [],
        catalogHeroEnabled: false,
        catalogHeroTitle: null,
        catalogHeroSubtitle: null,
        catalogHeroMediaId: null,
        catalogHeroMedia: null,
        galleryName: null,
        footerAbout: null,
        contactAddress: null,
        contactEmail: null,
        instagramUrl: null,
        telegramUrl: null,
        baleUrl: null,
        updatedAt: null,
      }),
    ).toBeNull();
  });

  it('parses homepage slides with media previews and ordered selections', () => {
    const slide = {
      id: 'slide-1',
      mediaId: 'media-1',
      media: {
        id: 'media-1',
        url: 'https://media.example.com/hero.webp',
        mimeType: 'image/webp',
        altText: 'کالکشن نقره',
      },
      title: 'کالکشن تازه',
      subtitle: null,
      actionLabel: null,
      actionHref: null,
      sortOrder: 1,
      isActive: true,
    };
    const result = parseAdminHomepageSettings({
      primaryHeroSlides: [slide],
      secondaryHero: null,
      featuredCategories: [{ id: 'category-1', priority: 1 }],
      popularProducts: [{ id: 'product-1', priority: 1 }],
      manufacturerCountriesEnabled: true,
      manufacturerCountries: [{ id: 'country-1', priority: 1 }],
      updatedAt: null,
    });

    expect(result?.primaryHeroSlides[0]?.media.url).toContain('hero.webp');
    expect(result?.categoryIds).toEqual(['category-1']);
    expect(result?.popularProductIds).toEqual(['product-1']);
    expect(result?.manufacturerCountriesEnabled).toBe(true);
    expect(result?.manufacturerCountryIds).toEqual(['country-1']);
  });

  it('parses public catalog references used by ordered selectors', () => {
    expect(parseCategoryReferences([{ id: 'category-1', name: 'انگشتر' }])).toEqual([
      { id: 'category-1', label: 'انگشتر' },
    ]);
    expect(parseProductReferences({ items: [{ id: 'product-1', name: 'گردنبند آوین' }] })).toEqual([
      { id: 'product-1', label: 'گردنبند آوین' },
    ]);
  });

  it('keeps only active country references for homepage selection', () => {
    expect(
      parseCountryReferences([
        { id: 'country-1', name: 'ایران', isActive: true },
        { id: 'country-2', name: 'ایتالیا', isActive: false },
      ]),
    ).toEqual([{ id: 'country-1', label: 'ایران' }]);
  });
});
