import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { ProductRecommendations } from './product-recommendations';
import { measureCatalogProducts } from '@/lib/analytics/commerce-events';

vi.mock('@/lib/analytics/commerce-events', () => ({ measureCatalogProducts: vi.fn() }));
vi.mock('@/components/catalog/catalog-product-card', () => ({
  CatalogProductCard: ({
    product,
    onSelect,
    recommendationId,
  }: {
    product: { name: string };
    onSelect: () => void;
    recommendationId: string;
  }) => (
    <li data-recommendation={recommendationId}>
      <button type="button" onClick={onSelect}>
        {product.name}
      </button>
    </li>
  ),
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

it('deduplicates recommendations and measures a visible card and selection once', async () => {
  const item = { id: '3', slug: 'pendant', name: 'آویز', isAvailable: true };
  const cart = { id: '1', slug: 'ring', name: 'انگشتر', isAvailable: true };
  const unavailable = { id: '2', slug: 'chain', name: 'زنجیر', isAvailable: false };
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ items: [cart, item, unavailable] }))),
  );
  const observer = { notify: undefined as IntersectionObserverCallback | undefined };
  const observeCard = vi.fn();
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: IntersectionObserverCallback) {
        observer.notify = callback;
      }
      observe = observeCard;
      unobserve = vi.fn();
      disconnect = vi.fn();
    },
  );

  render(<ProductRecommendations list="cart_recommendations" sources={['ring', 'bracelet']} />);
  const button = await screen.findByRole('button', { name: 'آویز' });
  expect(screen.getAllByRole('button')).toEqual([button]);
  expect(measureCatalogProducts).not.toHaveBeenCalled();

  const target = button.closest('li');
  if (!target) throw new Error('Expected the recommendation card to be a list item.');
  await waitFor(() => expect(observeCard).toHaveBeenCalledWith(target));
  const notify = observer.notify;
  if (!notify) throw new Error('Expected the recommendation card observer to be registered.');
  const rect = target.getBoundingClientRect();
  const entry: IntersectionObserverEntry = {
    target,
    isIntersecting: true,
    intersectionRatio: 1,
    boundingClientRect: rect,
    intersectionRect: rect,
    rootBounds: null,
    time: 0,
  };
  notify([entry], {} as IntersectionObserver);
  notify([entry], {} as IntersectionObserver);
  expect(measureCatalogProducts).toHaveBeenCalledTimes(1);
  expect(measureCatalogProducts).toHaveBeenCalledWith('view_item_list', 'cart_recommendations', [
    item,
  ]);
  fireEvent.click(button);
  expect(measureCatalogProducts).toHaveBeenCalledTimes(2);
  expect(measureCatalogProducts).toHaveBeenNthCalledWith(2, 'select_item', 'cart_recommendations', [
    item,
  ]);
});
