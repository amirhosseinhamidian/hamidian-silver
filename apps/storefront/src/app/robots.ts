import type { MetadataRoute } from 'next';

import { getStorefrontAbsoluteUrl, getStorefrontMetadataBase } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  const metadataBase = getStorefrontMetadataBase();

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/payment/'],
    },
    sitemap: getStorefrontAbsoluteUrl('/sitemap.xml', metadataBase),
    host: metadataBase.origin,
  };
}
