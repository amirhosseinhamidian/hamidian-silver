import { describe, expect, it } from 'vitest';

import { resolveStorefrontSeoRoutePolicy } from '@/lib/seo/route-policy';

describe('resolveStorefrontSeoRoutePolicy', () => {
  it.each(['/', '/products', '/brands', '/categories', '/about', '/faq'])(
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

  it('indexes the knowledge hub and its article documents', () => {
    expect(resolveStorefrontSeoRoutePolicy('/guide')).toMatchObject({ index: true, follow: true });
    expect(resolveStorefrontSeoRoutePolicy('/guide/silver-care')).toMatchObject({
      index: true,
      follow: true,
    });
  });

  it('keeps guide search and topic variants crawlable but out of the index', () => {
    expect(
      resolveStorefrontSeoRoutePolicy('/guide', new URLSearchParams({ q: 'نقره', topic: 'care' })),
    ).toMatchObject({ canonicalPath: '/guide', index: false, follow: true });
  });

  it.each(['/products', '/categories/rings', '/brands/cartier', '/guide'])(
    'keeps valid pagination on %s crawlable with a self canonical',
    (pathname) => {
      expect(
        resolveStorefrontSeoRoutePolicy(pathname, new URLSearchParams({ page: '3' })),
      ).toMatchObject({
        canonicalPath: `${pathname}?page=3`,
        index: true,
        follow: true,
      });
    },
  );

  it.each(['/products/ring', '/guide/silver-care'])(
    'keeps fake detail pagination on %s out of the index',
    (pathname) => {
      for (const page of ['1', '2', 'abc']) {
        expect(
          resolveStorefrontSeoRoutePolicy(pathname, new URLSearchParams({ page })),
        ).toMatchObject({ canonicalPath: pathname, index: false, follow: true });
      }
    },
  );

  it('does not index malformed pagination variants', () => {
    expect(
      resolveStorefrontSeoRoutePolicy('/products', new URLSearchParams({ page: 'abc' })),
    ).toMatchObject({
      canonicalPath: '/products',
      index: false,
      follow: true,
      reason: 'catalog-variant',
    });
  });

  it.each([
    'page=',
    'page=1',
    'page=02',
    'page=2e0',
    'page=2&page=2',
    'page=1001',
    'page=2&availability=',
    'page=2&unknown=',
  ])('keeps the noncanonical catalog request %s out of the index', (query) => {
    expect(
      resolveStorefrontSeoRoutePolicy('/categories/rings', new URLSearchParams(query)),
    ).toMatchObject({ canonicalPath: '/categories/rings', index: false, follow: true });
  });

  it('preserves the untracked canonical for campaign links including pagination and filtered listings', () => {
    for (const [path, query] of [
      ['/products', 'page=3'],
      ['/products', 'category=rings&page=3'],
      ['/products/silver-ring', ''],
      ['/guide', 'page=2'],
    ]) {
      const untracked = new URLSearchParams(query);
      const tracked = new URLSearchParams(untracked);
      tracked.set('utm_source', 'newsletter');
      tracked.set('utm_id', 'nowruz-1406');
      expect(resolveStorefrontSeoRoutePolicy(path, tracked)).toMatchObject({
        canonicalPath: resolveStorefrontSeoRoutePolicy(path, untracked).canonicalPath,
        index: false,
        follow: true,
      });
    }
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
