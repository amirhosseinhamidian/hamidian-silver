import type { Metadata } from 'next';
import { cookies } from 'next/headers';

import { CartRecoveryPanel } from '@/components/cart/cart-recovery-panel';
import { StorefrontHome } from '@/components/home/storefront-home';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { JsonLd } from '@/components/seo/json-ld';
import { getPublicHomepage } from '@/lib/home/public-homepage';
import { HOME_SEO } from '@/lib/seo/content-copy';
import { buildStorefrontPageMetadata } from '@/lib/seo/metadata';
import {
  buildOrganizationStructuredData,
  buildWebSiteStructuredData,
} from '@/lib/seo/structured-data';
import { getPublicShippingOptionsForSeo } from '@/lib/shipping/public-shipping-pricing';
import { getPublicSiteSettings } from '@/lib/site-settings/public-site-settings';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getPublicSiteSettings();
  return buildStorefrontPageMetadata(settings, {
    pathname: '/',
    title: settings.seoHomeTitle?.trim() || HOME_SEO.title,
    description: settings.seoHomeDescription?.trim() || HOME_SEO.description,
    seoOgMedia: settings.seoHomeOgMedia,
    absoluteTitle: true,
  });
}

export default async function StorefrontHomePage() {
  const [homepage, settings, shippingOptions, cookieStore] = await Promise.all([
    getPublicHomepage(),
    getPublicSiteSettings(),
    getPublicShippingOptionsForSeo(),
    cookies(),
  ]);

  return (
    <>
      <JsonLd data={buildOrganizationStructuredData(settings, shippingOptions)} />
      <JsonLd data={buildWebSiteStructuredData(settings)} />
      {cookieStore.has(SESSION_COOKIE_NAME) && (
        <div className="sf-container">
          <CartRecoveryPanel />
        </div>
      )}
      <StorefrontHome homepage={homepage} />
    </>
  );
}
