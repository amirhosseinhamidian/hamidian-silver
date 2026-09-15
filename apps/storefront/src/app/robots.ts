import type { MetadataRoute } from 'next';

import { getStorefrontAbsoluteUrl, getStorefrontMetadataBase } from '@/lib/seo/metadata';

export default function robots(): MetadataRoute.Robots {
  const metadataBase = getStorefrontMetadataBase();

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/account/', '/cart', '/checkout', '/payment/', '/wishlist'],
    },
    sitemap: getStorefrontAbsoluteUrl('/sitemap.xml', metadataBase),
    host: metadataBase.origin,
  };
}
