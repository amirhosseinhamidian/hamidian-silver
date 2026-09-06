import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CatalogProductGrid } from '@/components/catalog/catalog-product-grid';
import type {
  CatalogFilters,
  PublicCatalogProductList,
  PublicCatalogProductSummary,
} from '@/lib/catalog/public-catalog';

vi.mock('@/components/catalog/catalog-product-card', () => ({
  CatalogProductCard: ({ product }: { product: PublicCatalogProductSummary }) => (
    <li>{product.name}</li>
  ),
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
      <CatalogProductGrid
        filters={filters}
        initialProducts={productPage([firstProduct], 1, 2)}
      />,
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
      { cache: 'no-store' },
    );
  });

  it('offers a retry when loading the next page fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(null, 502))
      .mockResolvedValueOnce(jsonResponse(productPage([secondProduct], 2, 2)));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <CatalogProductGrid
        filters={filters}
        initialProducts={productPage([firstProduct], 1, 2)}
      />,
    );

    act(() => {
      intersectionCallback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'بارگذاری محصولات بیشتر انجام نشد.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'تلاش مجدد' }));

    expect(await screen.findByText('انگشتر دوم')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
