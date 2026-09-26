import type { Metadata } from 'next';

import { StorefrontHome } from '@/components/home/storefront-home';
import { JsonLd } from '@/components/seo/json-ld';
import { getPublicHomepage } from '@/lib/home/public-homepage';
import { buildStorefrontPageMetadata } from '@/lib/seo/metadata';
import { buildOrganizationStructuredData } from '@/lib/seo/structured-data';
import { getPublicShippingOptions } from '@/lib/shipping/public-shipping-pricing';
import { getPublicSiteSettings } from '@/lib/site-settings/public-site-settings';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getPublicSiteSettings();
  return buildStorefrontPageMetadata(settings, {
    pathname: '/',
    title: settings.seoHomeTitle ?? settings.seoDefaultTitle ?? 'گالری حمیدیان',
    description: settings.seoHomeDescription ?? settings.seoDefaultDescription,
    seoOgMedia: settings.seoHomeOgMedia,
    absoluteTitle: true,
  });
}

export default async function StorefrontHomePage() {
  const [homepage, settings, shippingOptions] = await Promise.all([
    getPublicHomepage(),
    getPublicSiteSettings(),
    getPublicShippingOptions(),
  ]);

  return (
    <>
      <JsonLd data={buildOrganizationStructuredData(settings, shippingOptions)} />
      <StorefrontHome homepage={homepage} />
    </>
  );
}
