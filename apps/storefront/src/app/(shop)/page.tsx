import type { Metadata } from 'next';

import { StorefrontHome } from '@/components/home/storefront-home';
import { getPublicHomepage } from '@/lib/home/public-homepage';
import { buildStorefrontPageMetadata } from '@/lib/seo/metadata';
import { getPublicSiteSettings } from '@/lib/site-settings/public-site-settings';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getPublicSiteSettings();
  return buildStorefrontPageMetadata(settings, {
    pathname: '/',
    title: settings.seoHomeTitle ?? settings.seoDefaultTitle ?? 'نقره حمیدیان',
    description: settings.seoHomeDescription ?? settings.seoDefaultDescription,
    seoOgMedia: settings.seoHomeOgMedia,
    absoluteTitle: true,
  });
}

export default async function StorefrontHomePage() {
  const homepage = await getPublicHomepage();

  return <StorefrontHome homepage={homepage} />;
}
