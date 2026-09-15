import { describe, expect, it } from 'vitest';

import { resolveStorefrontSeoRoutePolicy } from '@/lib/seo/route-policy';

describe('resolveStorefrontSeoRoutePolicy', () => {
  it.each(['/', '/products', '/brands', '/about', '/faq'])(
    'indexes the public route %s',
    (pathname) => {
      expect(resolveStorefrontSeoRoutePolicy(pathname)).toMatchObject({
        canonicalPath: pathname,
        index: true,
        follow: true,
      });
    },
  );

  it.each(['/products/ring', '/categories/rings', '/brands/cartier'])(
    'indexes a public catalog document at %s',
    (pathname) => {
      expect(resolveStorefrontSeoRoutePolicy(pathname)).toMatchObject({
        canonicalPath: pathname,
        index: true,
        follow: true,
        reason: 'catalog-page',
      });
    },
  );

  it('keeps paginated catalog pages crawlable with a self canonical', () => {
    expect(
      resolveStorefrontSeoRoutePolicy('/products', new URLSearchParams({ page: '3' })),
    ).toMatchObject({
      canonicalPath: '/products?page=3',
      index: true,
      follow: true,
    });
  });

  it.each([
    new URLSearchParams({ q: 'انگشتر' }),
    new URLSearchParams({ sort: 'price-desc' }),
    new URLSearchParams({ category: 'rings', page: '2' }),
  ])('does not index filtered or searched catalog variants', (searchParams) => {
    expect(resolveStorefrontSeoRoutePolicy('/products', searchParams)).toMatchObject({
      canonicalPath: '/products',
      index: false,
      follow: true,
      reason: 'catalog-variant',
    });
  });

  it.each(['/account', '/account/orders/order-1', '/cart', '/checkout', '/payment/result'])(
    'blocks indexing and following for private route %s',
    (pathname) => {
      expect(resolveStorefrontSeoRoutePolicy(pathname)).toMatchObject({
        index: false,
        follow: false,
        reason: 'private-page',
      });
    },
  );

  it('fails closed for a route that has not been added to the policy', () => {
    expect(resolveStorefrontSeoRoutePolicy('/future-page')).toEqual({
      canonicalPath: '/future-page',
      index: false,
      follow: false,
      reason: 'unknown-page',
    });
  });
});
