import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { StorefrontSearch } from '@/components/layout/storefront-search';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function openSearch() {
  render(<StorefrontSearch />);
  fireEvent.click(screen.getByRole('button', { name: 'جستجو در محصولات' }));
  return screen.getByRole('searchbox', { name: 'نام محصول' });
}

describe('StorefrontSearch', () => {
  it('debounces normalized suggestions and supports keyboard selection', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        items: [
          {
            id: 'product-1',
            name: 'انگشتر یاقوت',
            slug: 'ruby-ring',
            salePriceToman: 850_000,
            compareAtPriceToman: null,
            primaryMedia: null,
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const input = openSearch();

    fireEvent.change(input, { target: { value: 'انگشتر نقره' } });
    fireEvent.change(input, { target: { value: 'انگشتر ياقوت' } });
    await act(async () => {
      vi.advanceTimersByTime(299);
    });
    expect(fetchMock).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(1);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/catalog/search/suggestions?q=%D8%A7%D9%86%DA%AF%D8%B4%D8%AA%D8%B1%20%DB%8C%D8%A7%D9%82%D9%88%D8%AA',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    const option = screen.getByRole('option', { name: /انگشتر یاقوت/ });
    expect(option).toHaveAttribute('href', '/products/ruby-ring');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(option).toHaveAttribute('aria-selected', 'true');
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('aborts an in-flight suggestion request when the query changes', async () => {
    vi.useFakeTimers();
    let firstSignal: AbortSignal | undefined;
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      firstSignal ??= init?.signal as AbortSignal | undefined;
      return new Promise<Response>(() => {});
    });
    vi.stubGlobal('fetch', fetchMock);
    const input = openSearch();

    fireEvent.change(input, { target: { value: 'انگشتر' } });
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    expect(firstSignal?.aborted).toBe(false);

    fireEvent.change(input, { target: { value: 'گردنبند' } });
    expect(firstSignal?.aborted).toBe(true);
  });

  it('shows empty and API error states', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ items: [] }) })
      .mockResolvedValueOnce({ ok: false, json: vi.fn().mockResolvedValue({}) });
    vi.stubGlobal('fetch', fetchMock);
    const input = openSearch();

    fireEvent.change(input, { target: { value: 'ناموجود' } });
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    expect(screen.getByText('محصولی برای این عبارت پیدا نشد.')).toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'خطای جستجو' } });
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    expect(screen.getByRole('alert')).toHaveTextContent('دریافت پیشنهادها انجام نشد');
  });
});
