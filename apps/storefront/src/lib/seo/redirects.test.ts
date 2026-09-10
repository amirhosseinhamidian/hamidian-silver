import { describe, expect, it } from 'vitest';

import { validPublicCatalogRedirectPath } from '@/lib/seo/redirects';

describe('validPublicCatalogRedirectPath', () => {
  it.each(['/products/silver-ring', '/categories/rings', '/brands/cartier'])(
    'accepts the public catalog path %s',
    (pathname) => {
      expect(validPublicCatalogRedirectPath(pathname)).toBe(pathname);
    },
  );

  it.each([
    'https://attacker.example/products/ring',
    '//attacker.example/products/ring',
    '/account/orders/1',
    '/products/ring?next=/checkout',
    '/products/ring/extra',
  ])('rejects an unsafe redirect destination %s', (pathname) => {
    expect(validPublicCatalogRedirectPath(pathname)).toBeNull();
  });
});
