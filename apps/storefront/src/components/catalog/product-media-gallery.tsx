'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useRef, useState, type TouchEvent } from 'react';
import { FiChevronLeft, FiChevronRight, FiX } from 'react-icons/fi';

import { CatalogMedia } from '@/components/catalog/catalog-media';
import type { PublicCatalogMedia } from '@/lib/catalog/public-catalog';

type ProductMediaGalleryProps = Readonly<{
  productName: string;
  media: PublicCatalogMedia[];
  fallbackMedia?: PublicCatalogMedia | null;
  fallbackSrc?: string | null;
}>;

type GalleryItem = Readonly<{
  media: PublicCatalogMedia | null;
  fallbackSrc: string | null;
}>;

const persianNumber = new Intl.NumberFormat('fa-IR');
const swipeThreshold = 48;

function isImage(media: PublicCatalogMedia | null | undefined): media is PublicCatalogMedia {
  return Boolean(media?.url && media.mimeType.startsWith('image/'));
}

function canOpenItem(item: GalleryItem): boolean {
  return isImage(item.media) || Boolean(item.fallbackSrc?.trim());
}

export function ProductMediaGallery({
  productName,
  media,
  fallbackMedia = null,
  fallbackSrc = null,
}: ProductMediaGalleryProps) {
  const publicImages = media.filter(isImage);
  const items: GalleryItem[] =
    publicImages.length > 0
      ? publicImages.map((item) => ({ media: item, fallbackSrc: null }))
      : [{ media: fallbackMedia, fallbackSrc }];
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const activeItem = items[activeIndex] ?? items[0];
  const hasMultipleImages = items.length > 1;

  function openAt(index: number) {
    setActiveIndex(index);
    setOpen(true);
  }

  function showPrevious() {
    setActiveIndex((current) => (current - 1 + items.length) % items.length);
  }

  function showNext() {
    setActiveIndex((current) => (current + 1) % items.length);
  }

  function handleTouchStart(event: TouchEvent<HTMLElement>) {
    touchStartX.current = event.changedTouches[0]?.clientX ?? null;
  }

  function handleTouchCancel() {
    touchStartX.current = null;
  }

  function handleTouchEnd(event: TouchEvent<HTMLElement>) {
    const startX = touchStartX.current;
    const endX = event.changedTouches[0]?.clientX;
    touchStartX.current = null;

    if (!hasMultipleImages || startX === null || endX === undefined) {
      return;
    }

    const distance = startX - endX;

    if (distance > swipeThreshold) {
      showNext();
    } else if (distance < -swipeThreshold) {
      showPrevious();
    }
  }

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);

        if (!nextOpen) {
          touchStartX.current = null;
        }
      }}
    >
      <div
        data-testid="mobile-product-gallery"
        role="group"
        aria-label={`تصاویر محصول ${productName}`}
        aria-roledescription={hasMultipleImages ? 'carousel' : undefined}
        onTouchStart={hasMultipleImages ? handleTouchStart : undefined}
        onTouchCancel={hasMultipleImages ? handleTouchCancel : undefined}
        onTouchEnd={hasMultipleImages ? handleTouchEnd : undefined}
        className="
          relative isolate aspect-[4/5] touch-pan-y overflow-hidden
          rounded-[var(--sf-radius-md)] bg-[var(--sf-color-surface)] lg:hidden
        "
      >
        {items.map((item, index) => (
          <div
            key={`mobile-${item.media?.url ?? item.fallbackSrc ?? 'placeholder'}-${index}`}
            aria-hidden={index !== activeIndex}
            className={`absolute inset-0 transition-opacity duration-700 ${
              index === activeIndex ? 'opacity-100' : 'pointer-events-none opacity-0'
            }`}
          >
            <CatalogMedia
              media={item.media}
              fallbackSrc={item.fallbackSrc}
              alt={`${productName}، تصویر ${persianNumber.format(
                index + 1,
              )} از ${persianNumber.format(items.length)}`}
              eager={index === 0}
              fetchPriority={index === 0 ? 'high' : undefined}
              sizes="(min-width: 1024px) 50vw, 100vw"
              imageClassName="object-cover select-none"
            />
          </div>
        ))}

        {hasMultipleImages ? (
          <>
            <button
              type="button"
              aria-label="تصویر قبلی گالری محصول"
              onClick={showPrevious}
              className="
                absolute start-3 top-1/2 z-20 flex size-11 -translate-y-1/2
                items-center justify-center border border-white/70 bg-black/15
                text-white transition-colors hover:bg-black/40
              "
            >
              <FiChevronRight aria-hidden="true" className="size-6" />
            </button>
            <button
              type="button"
              aria-label="تصویر بعدی گالری محصول"
              onClick={showNext}
              className="
                absolute end-3 top-1/2 z-20 flex size-11 -translate-y-1/2
                items-center justify-center border border-white/70 bg-black/15
                text-white transition-colors hover:bg-black/40
              "
            >
              <FiChevronLeft aria-hidden="true" className="size-6" />
            </button>

            <div
              data-testid="product-gallery-indicators"
              className="absolute inset-x-0 bottom-5 z-20 flex justify-center gap-2"
            >
              {items.map((item, index) => (
                <button
                  key={`indicator-${item.media?.url ?? item.fallbackSrc ?? 'placeholder'}-${index}`}
                  type="button"
                  aria-label={`نمایش تصویر ${persianNumber.format(index + 1)}`}
                  aria-current={index === activeIndex ? 'true' : undefined}
                  onClick={() => setActiveIndex(index)}
                  className={`h-1 transition-all ${
                    index === activeIndex ? 'w-10 bg-white' : 'w-5 bg-white/50 hover:bg-white/80'
                  }`}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>

      <div className="hidden gap-3 lg:grid lg:grid-cols-2">
        {items.map((item, index) => {
          const tileClassName =
            index === 0
              ? 'aspect-[4/5] overflow-hidden bg-[var(--sf-color-surface)] sm:col-span-2'
              : 'aspect-square overflow-hidden bg-[var(--sf-color-surface)]';
          const mediaContent = (
            <CatalogMedia
              media={item.media}
              fallbackSrc={item.fallbackSrc}
              alt={productName}
              eager={index === 0}
              fetchPriority={index === 0 ? 'high' : undefined}
              sizes="(min-width: 1024px) 50vw, 100vw"
              imageClassName="object-cover transition-transform duration-700 group-hover:scale-[1.02]"
            />
          );

          return canOpenItem(item) ? (
            <button
              key={`${item.media?.url ?? item.fallbackSrc ?? 'placeholder'}-${index}`}
              type="button"
              aria-label={`نمایش تمام‌صفحه تصویر ${persianNumber.format(index + 1)} از ${persianNumber.format(
                items.length,
              )} محصول ${productName}`}
              onClick={() => openAt(index)}
              className={`group hidden h-full w-full cursor-zoom-in lg:block ${tileClassName}`}
            >
              {mediaContent}
            </button>
          ) : (
            <div key={`placeholder-${index}`} className={tileClassName}>
              {mediaContent}
            </div>
          );
        })}
      </div>

      <DialogPrimitive.Portal>
        <DialogPrimitive.Content
          dir="rtl"
          aria-describedby="product-gallery-description"
          onKeyDown={(event) => {
            if (!hasMultipleImages) {
              return;
            }

            if (event.key === 'ArrowRight') {
              event.preventDefault();
              showPrevious();
            }

            if (event.key === 'ArrowLeft') {
              event.preventDefault();
              showNext();
            }
          }}
          className="
            fixed inset-0 z-[110] hidden h-[100dvh] grid-rows-[auto_minmax(0,1fr)]
            overflow-hidden bg-[var(--sf-color-canvas)]
            data-[state=closed]:animate-[sf-overlay-close_240ms_ease-in_forwards]
            data-[state=open]:animate-[sf-overlay-open_300ms_ease-out]
            lg:grid
          "
        >
          <header
            className="
              relative z-20 flex min-h-16 items-center justify-center
              border-b border-[var(--sf-color-border)] px-16 sm:min-h-20
            "
          >
            <DialogPrimitive.Title className="flex min-w-0 items-center justify-center gap-2 text-sm font-medium sm:text-base">
              <span className="truncate">{productName}</span>
              <span
                aria-live="polite"
                className="shrink-0 font-normal text-[var(--sf-color-muted)]"
                dir="ltr"
              >
                ({persianNumber.format(activeIndex + 1)}/{persianNumber.format(items.length)})
              </span>
            </DialogPrimitive.Title>

            <DialogPrimitive.Close
              aria-label="بستن نمایش تمام‌صفحه تصویر"
              className="
                absolute end-4 top-1/2 inline-flex size-10 -translate-y-1/2
                items-center justify-center border border-[var(--sf-color-border)]
                bg-[var(--sf-color-canvas)] transition-colors
                hover:border-[var(--sf-color-ink)] sm:end-6
              "
            >
              <FiX aria-hidden="true" className="size-5" />
            </DialogPrimitive.Close>
          </header>

          <DialogPrimitive.Description id="product-gallery-description" className="sr-only">
            نمایش تمام‌صفحه تصاویر محصول. با کلیدهای جهت یا حرکت دست روی تصویر، بین تصاویر جابه‌جا
            شوید و برای بستن کلید Escape را فشار دهید.
          </DialogPrimitive.Description>

          <div
            role="group"
            aria-label="تصاویر تمام‌صفحه محصول"
            aria-roledescription="carousel"
            onTouchStart={handleTouchStart}
            onTouchCancel={handleTouchCancel}
            onTouchEnd={handleTouchEnd}
            className="relative min-h-0 touch-pan-y overflow-hidden p-4 sm:p-8 lg:px-24 lg:py-10"
          >
            <div
              key={`${activeItem.media?.url ?? activeItem.fallbackSrc ?? 'placeholder'}-${
                activeIndex
              }`}
              className="h-full w-full animate-[sf-overlay-open_240ms_ease-out] motion-reduce:animate-none"
            >
              <CatalogMedia
                media={activeItem.media}
                fallbackSrc={activeItem.fallbackSrc}
                alt={`${productName}، تصویر ${persianNumber.format(
                  activeIndex + 1,
                )} از ${persianNumber.format(items.length)}`}
                eager
                sizes="100vw"
                imageClassName="object-contain select-none"
              />
            </div>

            {hasMultipleImages ? (
              <>
                <button
                  type="button"
                  aria-label="تصویر قبلی"
                  aria-keyshortcuts="ArrowRight"
                  onClick={showPrevious}
                  className="
                    absolute start-3 top-1/2 z-10 flex size-10 -translate-y-1/2
                    items-center justify-center border border-[var(--sf-color-border)]
                    bg-white/85 shadow-sm backdrop-blur-sm transition-colors
                    hover:border-[var(--sf-color-ink)] sm:start-6 sm:size-12
                  "
                >
                  <FiChevronRight aria-hidden="true" className="size-6" />
                </button>
                <button
                  type="button"
                  aria-label="تصویر بعدی"
                  aria-keyshortcuts="ArrowLeft"
                  onClick={showNext}
                  className="
                    absolute end-3 top-1/2 z-10 flex size-10 -translate-y-1/2
                    items-center justify-center border border-[var(--sf-color-border)]
                    bg-white/85 shadow-sm backdrop-blur-sm transition-colors
                    hover:border-[var(--sf-color-ink)] sm:end-6 sm:size-12
                  "
                >
                  <FiChevronLeft aria-hidden="true" className="size-6" />
                </button>
              </>
            ) : null}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
