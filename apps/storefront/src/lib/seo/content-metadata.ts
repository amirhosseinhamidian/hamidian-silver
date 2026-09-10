import type { Metadata } from 'next';

import { getPublicContentPage, type PublicContentPageKey } from '@/lib/content/public-content-page';
import { buildStorefrontPageMetadata } from '@/lib/seo/metadata';
import { getPublicSiteSettings } from '@/lib/site-settings/public-site-settings';

export async function getContentPageMetadata(
  key: PublicContentPageKey,
  pathname: string,
): Promise<Metadata> {
  const [page, settings] = await Promise.all([getPublicContentPage(key), getPublicSiteSettings()]);

  return buildStorefrontPageMetadata(settings, {
    pathname,
    title: page.title,
    description: page.subtitle ?? page.body,
    seoTitle: page.seoTitle,
    seoDescription: page.seoDescription,
    seoCanonicalPath: page.seoCanonicalPath,
    seoNoIndex: page.seoNoIndex,
    seoOgMedia: page.seoOgMedia,
    fallbackMedia: page.heroMedia,
  });
}
