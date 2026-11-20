import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CatalogProductGrid } from '@/components/catalog/catalog-product-grid';
import type {
  CatalogFilters,
  PublicCatalogProductList,
  PublicCatalogProductSummary,
} from '@/lib/catalog/public-catalog';

vi.mock('@/components/catalog/catalog-product-card', () => ({
  CatalogProductCard: ({
    product,
    preloadImage,
  }: {
    product: PublicCatalogProductSummary;
    preloadImage?: boolean;
  }) => <li data-preload-image={preloadImage ? 'true' : 'false'}>{product.name}</li>,
}));

const filters: CatalogFilters = {
  page: 1,
  pageSize: 24,
  category: 'rings',
  sort: 'price-asc',
};

const firstProduct = {
  id: '10000000-0000-4000-8000-000000000001',
  name: 'انگشتر اول',
} as PublicCatalogProductSummary;
const secondProduct = {
  id: '10000000-0000-4000-8000-000000000002',
  name: 'انگشتر دوم',
} as PublicCatalogProductSummary;

function productPage(
  items: PublicCatalogProductSummary[],
  page: number,
  totalPages: number,
): PublicCatalogProductList {
  return {
    items,
    page,
    pageSize: 24,
    total: 2,
    totalPages,
  };
}

function jsonResponse(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  } as Response;
}

describe('CatalogProductGrid', () => {
  let intersectionCallback: IntersectionObserverCallback = () => undefined;

  beforeEach(() => {
    class IntersectionObserverMock {
      constructor(callback: IntersectionObserverCallback) {
        intersectionCallback = callback;
      }

      observe() {}
      disconnect() {}
      unobserve() {}
    }

    vi.stubGlobal('IntersectionObserver', IntersectionObserverMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads and appends the next page when the list end enters the viewport', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(productPage([secondProduct], 2, 2)));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <CatalogProductGrid filters={filters} initialProducts={productPage([firstProduct], 1, 2)} />,
    );

    expect(screen.getByRole('link', { name: 'رفتن به صفحه ۲' })).toHaveAttribute(
      'href',
      '/products?category=rings&sort=price-asc&page=2',
    );

    act(() => {
      intersectionCallback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });

    expect(await screen.findByText('انگشتر دوم')).toBeInTheDocument();
    expect(screen.getByText('انگشتر اول')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/catalog/products?page=2&category=rings&sort=price-asc',
      { cache: 'no-store', signal: expect.any(AbortSignal) },
    );
  });

  it('cancels a page request when filters start changing and ignores its late response', async () => {
    let resolveRequest: (response: Response) => void = () => undefined;
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveRequest = resolve;
        }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const initialProducts = productPage([firstProduct], 1, 2);
    const scope = { category: 'rings' };
    const { rerender } = render(
      <CatalogProductGrid filters={filters} initialProducts={initialProducts} facetScope={scope} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'نمایش محصولات بیشتر' }));
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/catalog/facets?category=rings&sort=price-asc&page=2&scopeCategory=rings',
      { cache: 'no-store', signal: expect.any(AbortSignal) },
    );
    const signal = fetchMock.mock.calls[0][1]?.signal as AbortSignal;
    rerender(
      <CatalogProductGrid
        filters={filters}
        initialProducts={initialProducts}
        facetScope={scope}
        paused
      />,
    );
    expect(signal.aborted).toBe(true);

    await act(async () => {
      resolveRequest(jsonResponse(productPage([secondProduct], 2, 2)));
    });
    expect(screen.queryByText('انگشتر دوم')).not.toBeInTheDocument();
    expect(screen.getByText('انگشتر اول')).toBeInTheDocument();
  });

  it('prioritizes only the first initial product image when requested', () => {
    render(
      <CatalogProductGrid
        filters={filters}
        initialProducts={productPage([firstProduct, secondProduct], 1, 1)}
        prioritizeFirstImage
      />,
    );

    expect(screen.getByText('انگشتر اول')).toHaveAttribute('data-preload-image', 'true');
    expect(screen.getByText('انگشتر دوم')).toHaveAttribute('data-preload-image', 'false');
  });

  it('builds followable HTML pagination for the clean collection', () => {
    render(
      <CatalogProductGrid
        filters={{ page: 2, pageSize: 24, sort: 'newest' }}
        initialProducts={productPage([firstProduct], 2, 3)}
        paginationPath="/categories/rings"
        facetScope={{ category: 'rings' }}
      />,
    );

    const nextPage = screen.getByRole('link', { name: 'رفتن به صفحه ۳' });
    expect(nextPage).toHaveAttribute('href', '/categories/rings?page=3');
    expect(nextPage).not.toHaveAttribute('rel', 'nofollow');
  });

  it('keeps the filters in pagination links and marks them nofollow', () => {
    render(
      <CatalogProductGrid
        filters={{ ...filters, brand: 'sample', category: undefined }}
        initialProducts={productPage([firstProduct], 1, 2)}
        paginationPath="/categories/rings"
        facetScope={{ category: 'rings' }}
      />,
    );

    const nextPage = screen.getByRole('link', { name: 'رفتن به صفحه ۲' });
    expect(nextPage).toHaveAttribute(
      'href',
      '/categories/rings?brand=sample&sort=price-asc&page=2',
    );
    expect(nextPage).toHaveAttribute('rel', 'nofollow');
  });

  it('offers a retry when loading the next page fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(null, 502))
      .mockResolvedValueOnce(jsonResponse(productPage([secondProduct], 2, 2)));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <CatalogProductGrid filters={filters} initialProducts={productPage([firstProduct], 1, 2)} />,
    );

    act(() => {
      intersectionCallback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('بارگذاری محصولات بیشتر انجام نشد.');
    fireEvent.click(screen.getByRole('button', { name: 'تلاش مجدد' }));

    expect(await screen.findByText('انگشتر دوم')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
