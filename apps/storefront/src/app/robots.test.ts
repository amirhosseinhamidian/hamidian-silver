import { describe, expect, it } from 'vitest';

import robots from '@/app/robots';

describe('robots metadata route', () => {
  it('keeps utility HTML crawlable so noindex can be observed', () => {
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
    const wildcard = rules.find((rule) => rule.userAgent === '*');

    expect(wildcard).toBeDefined();
    expect(wildcard?.disallow).toEqual(['/api/', '/payment/']);
    expect(wildcard?.allow).toBe('/');
  });

  it('publishes the absolute production-style sitemap URL from metadata base', () => {
    const previous = process.env.STOREFRONT_PUBLIC_ORIGIN;
    process.env.STOREFRONT_PUBLIC_ORIGIN = 'https://silver.example';

    try {
      expect(robots().sitemap).toBe('https://silver.example/sitemap.xml');
    } finally {
      if (previous === undefined) {
        delete process.env.STOREFRONT_PUBLIC_ORIGIN;
      } else {
        process.env.STOREFRONT_PUBLIC_ORIGIN = previous;
      }
    }
  });
});
