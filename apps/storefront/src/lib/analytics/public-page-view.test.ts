import { describe, expect, it } from 'vitest';

import { publicPageView } from '@/lib/analytics/public-page-view';

describe('public analytics page views', () => {
  it('records only canonical, query-free public paths', () => {
    expect(publicPageView('/products', 'https://hamidian.shop')).toEqual({
      page_location: 'https://hamidian.shop/products',
      page_path: '/products',
      page_title: 'محصولات',
      page_referrer: '',
    });
  });

  it('excludes private, payment, unknown and user-supplied dynamic paths', () => {
    for (const path of ['/account', '/checkout', '/payment/result', '/products/09123456789']) {
      expect(publicPageView(path, 'https://hamidian.shop')).toBeNull();
    }
  });

  it('rejects unexpected origins', () => {
    expect(publicPageView('/', 'https://hamidian.shop/?q=secret')).toBeNull();
  });
});
