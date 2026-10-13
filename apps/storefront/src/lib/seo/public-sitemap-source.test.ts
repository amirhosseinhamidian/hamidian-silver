import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  createServerApiClient: vi.fn(),
}));

vi.mock('next/cache', () => ({
  unstable_cache: (loader: (...arguments_: never[]) => unknown) => loader,
}));
vi.mock('react', () => ({ cache: (loader: (...arguments_: never[]) => unknown) => loader }));
vi.mock('@/lib/api/server-client', () => ({
  createServerApiClient: mocks.createServerApiClient,
}));

import { getPublicSeoSitemap } from '@/lib/seo/public-sitemap-source';

describe('getPublicSeoSitemap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.HAMIDIAN_API_ORIGIN = 'https://api.example';
    mocks.createServerApiClient.mockReturnValue({ GET: mocks.get });
  });

  it('loads the complete sitemap source with one API request', async () => {
    const source = { products: [], categories: [], brands: [], contentPages: [] };
    mocks.get.mockResolvedValue({
      response: new Response(null, { status: 200 }),
      data: source,
    });

    await expect(getPublicSeoSitemap()).resolves.toBe(source);

    expect(mocks.createServerApiClient).toHaveBeenCalledWith({
      apiOrigin: 'https://api.example',
    });
    expect(mocks.get).toHaveBeenCalledTimes(1);
    expect(mocks.get).toHaveBeenCalledWith('/api/v1/seo/sitemap');
  });

  it('fails closed when the sitemap source endpoint is unavailable', async () => {
    mocks.get.mockResolvedValue({
      response: new Response(null, { status: 503 }),
      data: undefined,
    });

    await expect(getPublicSeoSitemap()).rejects.toThrow(
      'Failed to load the public SEO sitemap source.',
    );
  });
});
