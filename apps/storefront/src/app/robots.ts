import type { MetadataRoute } from 'next';

import { getStorefrontAbsoluteUrl, getStorefrontMetadataBase } from '@/lib/seo/metadata';

export default function robots(): MetadataRoute.Robots {
  const metadataBase = getStorefrontMetadataBase();

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Public HTML utility pages stay crawlable so their noindex directives can
      // be observed. API endpoints and payment-result paths are not crawl targets.
      disallow: ['/api/', '/payment/'],
    },
    sitemap: getStorefrontAbsoluteUrl('/sitemap.xml', metadataBase),
    host: metadataBase.origin,
  };
}
