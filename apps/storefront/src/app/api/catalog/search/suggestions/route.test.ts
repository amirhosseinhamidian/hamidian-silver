import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GET } from '@/app/api/catalog/search/suggestions/route';

const { getPublicCatalogProductSuggestions } = vi.hoisted(() => ({
  getPublicCatalogProductSuggestions: vi.fn(),
}));

vi.mock('@/lib/catalog/public-catalog', () => ({
  getPublicCatalogProductSuggestions,
}));

describe('catalog search suggestions BFF', () => {
  beforeEach(() => getPublicCatalogProductSuggestions.mockReset());

  it('normalizes the query and proxies a bounded suggestion request', async () => {
    getPublicCatalogProductSuggestions.mockResolvedValue({ items: [] });

    const response = await GET(
      new Request('http://storefront.local/api/catalog/search/suggestions?q=انگشتر‌%20كيان'),
    );

    expect(response.status).toBe(200);
    expect(getPublicCatalogProductSuggestions).toHaveBeenCalledWith('انگشتر کیان', 8);
    await expect(response.json()).resolves.toEqual({ items: [] });
  });

  it('returns an empty result for short queries without calling the API', async () => {
    const response = await GET(
      new Request('http://storefront.local/api/catalog/search/suggestions?q=ا'),
    );

    expect(response.status).toBe(200);
    expect(getPublicCatalogProductSuggestions).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({ items: [] });
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
