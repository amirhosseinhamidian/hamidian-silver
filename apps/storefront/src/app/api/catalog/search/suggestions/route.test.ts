import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GET } from '@/app/api/catalog/search/suggestions/route';
import { CatalogSuggestionsBusyError } from '@/lib/catalog/public-catalog';

const { getPublicCatalogProductSuggestions } = vi.hoisted(() => ({
  getPublicCatalogProductSuggestions: vi.fn(),
}));

vi.mock('@/lib/catalog/public-catalog', async (original) => ({
  ...(await original<typeof import('@/lib/catalog/public-catalog')>()),
  getPublicCatalogProductSuggestions,
}));

describe('catalog search suggestions BFF', () => {
  beforeEach(() => getPublicCatalogProductSuggestions.mockReset());

  it('normalizes the query and proxies a bounded suggestion request', async () => {
    getPublicCatalogProductSuggestions.mockResolvedValue({
      items: [],
      categories: [],
      brands: [],
    });

    const response = await GET(
      new Request('http://storefront.local/api/catalog/search/suggestions?q=انگشتر‌%20كيان'),
    );

    expect(response.status).toBe(200);
    expect(getPublicCatalogProductSuggestions).toHaveBeenCalledWith(
      'انگشتر کیان',
      8,
      expect.any(AbortSignal),
    );
    await expect(response.json()).resolves.toEqual({ items: [], categories: [], brands: [] });
  });

  it('preserves temporary overload as 429', async () => {
    getPublicCatalogProductSuggestions.mockRejectedValueOnce(new CatalogSuggestionsBusyError());
    const response = await GET(
      new Request('http://storefront.local/api/catalog/search/suggestions?q=انگشتر'),
    );
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('2');
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('returns an empty result for short queries without calling the API', async () => {
    const response = await GET(
      new Request('http://storefront.local/api/catalog/search/suggestions?q=ا'),
    );

    expect(response.status).toBe(200);
    expect(getPublicCatalogProductSuggestions).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({ items: [], categories: [], brands: [] });
  });

  it('maps upstream failures to a stable error response', async () => {
    getPublicCatalogProductSuggestions.mockImplementationOnce(() => {
      throw new Error('offline');
    });

    const response = await GET(
      new Request('http://storefront.local/api/catalog/search/suggestions?q=انگشتر'),
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      message: 'دریافت پیشنهادهای جست‌وجو انجام نشد.',
    });
  });
});
