'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import Link from 'next/link';
import { type KeyboardEvent, useEffect, useId, useRef, useState } from 'react';
import { FiSearch, FiX } from 'react-icons/fi';

import { CatalogMedia } from '@/components/catalog/catalog-media';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-control';
import { trackSearch } from '@/lib/analytics/commerce-events';
import type { PublicCatalogProductSuggestion } from '@/lib/catalog/public-catalog';
import { formatTomanPrice } from '@/lib/catalog/presentation';
import { normalizeCatalogSearchText } from '@/lib/catalog/search-normalization';

type SuggestionStatus = 'idle' | 'loading' | 'success' | 'empty' | 'error';

function parseSuggestions(value: unknown): PublicCatalogProductSuggestion[] | null {
  if (!value || typeof value !== 'object' || !('items' in value) || !Array.isArray(value.items)) {
    return null;
  }

  const items = value.items.filter((item): item is PublicCatalogProductSuggestion => {
    if (!item || typeof item !== 'object') return false;
    const candidate = item as Record<string, unknown>;
    return (
      typeof candidate.id === 'string' &&
      typeof candidate.name === 'string' &&
      typeof candidate.slug === 'string' &&
      (typeof candidate.salePriceToman === 'number' || candidate.salePriceToman === null)
    );
  });

  return items.length === value.items.length ? items.slice(0, 8) : null;
}

export function StorefrontSearch() {
  const listboxId = useId();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PublicCatalogProductSuggestion[]>([]);
  const [status, setStatus] = useState<SuggestionStatus>('idle');
  const [activeIndex, setActiveIndex] = useState(-1);
  const optionRefs = useRef<Array<HTMLAnchorElement | null>>([]);

  const normalizedQuery = normalizeCatalogSearchText(query);
  const showSuggestions = normalizedQuery.length >= 2;

  useEffect(() => {
    const search = normalizeCatalogSearchText(query);

    if (search.length < 2) {
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void (async () => {
        try {
          const response = await fetch(
            `/api/catalog/search/suggestions?q=${encodeURIComponent(search)}`,
            { signal: controller.signal },
          );
          const payload = (await response.json().catch(() => null)) as unknown;
          if (!response.ok) throw new Error('Suggestion request failed.');
          const items = parseSuggestions(payload);
          if (!items) throw new Error('Suggestion response was invalid.');
          setSuggestions(items);
          setStatus(items.length > 0 ? 'success' : 'empty');
        } catch {
          if (controller.signal.aborted) return;
          setSuggestions([]);
          setStatus('error');
        }
      })();
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [query]);

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (suggestions.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => (current >= suggestions.length - 1 ? 0 : current + 1));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => (current <= 0 ? suggestions.length - 1 : current - 1));
      return;
    }

    if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      optionRefs.current[activeIndex]?.click();
    }
  }

  return (
    <DialogPrimitive.Root>
      <DialogPrimitive.Trigger asChild>
        <button
          type="button"
          aria-label="جستجو در محصولات"
          className="
            inline-flex size-9 items-center justify-center
            transition-opacity duration-150 hover:opacity-55
          "
        >
          <FiSearch aria-hidden="true" size={22} />
        </button>
      </DialogPrimitive.Trigger>

      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="
            fixed inset-0 z-[90] bg-black/35
            data-[state=closed]:animate-[sf-overlay-close_420ms_cubic-bezier(0.16,1,0.3,1)_forwards]
            data-[state=open]:animate-[sf-overlay-open_480ms_cubic-bezier(0.16,1,0.3,1)]
          "
        />
        <DialogPrimitive.Content
          className="
            fixed inset-x-0 top-0 z-[100]
            border-b border-[var(--sf-color-border)] bg-[var(--sf-color-canvas)]
            px-5 py-6 shadow-sm sm:px-8 sm:py-8
            data-[state=closed]:animate-[sf-overlay-close_300ms_ease-in_forwards]
            data-[state=open]:animate-[sf-overlay-open_360ms_ease-out]
          "
        >
          <div className="mx-auto max-w-3xl">
            <div className="flex items-center justify-between gap-4">
              <DialogPrimitive.Title className="text-lg font-medium sm:text-xl">
                جستجو در محصولات
              </DialogPrimitive.Title>
              <DialogPrimitive.Close
                aria-label="بستن جستجو"
                className="
                  inline-flex size-10 items-center justify-center
                  rounded-[var(--sf-radius-md)] border border-[var(--sf-color-border)]
                  transition-colors hover:border-[var(--sf-color-ink)]
                "
              >
                <FiX aria-hidden="true" size={21} />
              </DialogPrimitive.Close>
            </div>

            <DialogPrimitive.Description className="mt-2 text-xs text-[var(--sf-color-muted)]">
              نام محصول، برند، دسته‌بندی یا کد محصول را وارد کنید.
            </DialogPrimitive.Description>

            <form
              action="/products"
              method="get"
              role="search"
              className="mt-5 flex items-start gap-2"
              onSubmit={(event) => {
                if (!normalizedQuery) event.preventDefault();
              }}
            >
              <div className="relative min-w-0 flex-1">
                <label htmlFor="storefront-product-search" className="sr-only">
                  نام محصول
                </label>
                <Input
                  id="storefront-product-search"
                  type="search"
                  name="q"
                  value={query}
                  onChange={(event) => {
                    const nextQuery = event.target.value;
                    const nextSearch = normalizeCatalogSearchText(nextQuery);

                    setQuery(nextQuery);
                    setSuggestions([]);
                    setActiveIndex(-1);
                    setStatus(nextSearch.length >= 2 ? 'loading' : 'idle');
                  }}
                  onKeyDown={handleSearchKeyDown}
                  maxLength={100}
                  placeholder="مثلاً انگشتر نقره"
                  autoComplete="off"
                  role="combobox"
                  aria-autocomplete="list"
                  aria-controls={showSuggestions ? listboxId : undefined}
                  aria-expanded={showSuggestions}
                  aria-activedescendant={
                    activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined
                  }
                  className="w-full"
                />

                {showSuggestions ? (
                  <div
                    id={listboxId}
                    className="
                      absolute inset-x-0 top-[calc(100%+0.5rem)] z-10 max-h-[65vh] overflow-y-auto
                      rounded-[var(--sf-radius-lg)] border border-[var(--sf-color-border)]
                      bg-[var(--sf-color-canvas)] shadow-lg
                    "
                  >
                    {status === 'loading' ? (
                      <p className="px-4 py-5 text-sm text-[var(--sf-color-muted)]" role="status">
                        در حال جست‌وجو…
                      </p>
                    ) : null}
                    {status === 'empty' ? (
                      <p className="px-4 py-5 text-sm text-[var(--sf-color-muted)]" role="status">
                        محصولی برای این عبارت پیدا نشد.
                      </p>
                    ) : null}
                    {status === 'error' ? (
                      <p
                        className="px-4 py-5 text-sm font-medium text-[var(--sf-color-ink)]"
                        role="alert"
                      >
                        دریافت پیشنهادها انجام نشد. دوباره تلاش کنید.
                      </p>
                    ) : null}
                    {status === 'success' ? (
                      <ul role="listbox" aria-label="پیشنهادهای جست‌وجو">
                        {suggestions.map((suggestion, index) => (
                          <li key={suggestion.id}>
                            <DialogPrimitive.Close asChild>
                              <Link
                                ref={(element) => {
                                  optionRefs.current[index] = element;
                                }}
                                id={`${listboxId}-option-${index}`}
                                role="option"
                                aria-selected={activeIndex === index}
                                href={`/products/${suggestion.slug}`}
                                onClick={() => trackSearch(normalizedQuery, suggestions.length)}
                                className="
                                  grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-3 px-3 py-2.5
                                  transition-colors hover:bg-[var(--sf-color-surface)]
                                  aria-selected:bg-[var(--sf-color-surface)]
                                "
                              >
                                <span className="h-14 overflow-hidden rounded-[var(--sf-radius-md)] bg-[var(--sf-color-surface)]">
                                  <CatalogMedia
                                    media={suggestion.primaryMedia}
                                    alt={suggestion.name}
                                    sizes="56px"
                                  />
                                </span>
                                <span className="min-w-0">
                                  <span className="block truncate text-sm font-medium">
                                    {suggestion.name}
                                  </span>
                                  <span className="mt-1 block text-xs text-[var(--sf-color-muted)]">
                                    {formatTomanPrice(suggestion.salePriceToman)}
                                  </span>
                                </span>
                              </Link>
                            </DialogPrimitive.Close>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <Button type="submit" aria-label="اجرای جستجو">
                <FiSearch aria-hidden="true" size={18} />
                <span className="hidden sm:inline">جستجو</span>
              </Button>
            </form>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
