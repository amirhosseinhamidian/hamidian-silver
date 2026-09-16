'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';

import { ResponsiveHeroImage } from '@/components/media/responsive-hero-image';
import type { PublicHomepageHeroSlide } from '@/lib/home/public-homepage';

type HomepageHeroProps = Readonly<{
  slides: PublicHomepageHeroSlide[];
  label: string;
  compact?: boolean;
  preload?: boolean;
}>;

function HeroAction({ href, label }: Readonly<{ href: string; label: string }>) {
  const className =
    'inline-flex min-h-11 items-center justify-center border border-current px-7 text-sm font-medium text-current transition-opacity hover:opacity-75';

  return href.startsWith('/') && !href.startsWith('//') ? (
    <Link href={href} className={className}>
      {label}
    </Link>
  ) : (
    <a href={href} target="_blank" rel="noreferrer" className={className}>
      {label}
    </a>
  );
}

export function HomepageHero({
  slides,
  label,
  compact = false,
  preload = false,
}: HomepageHeroProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const hasSlider = slides.length > 1;
  const activeSlide = slides[activeIndex] ?? slides[0];

  useEffect(() => {
    if (!hasSlider || paused || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % slides.length);
    }, 6000);

    return () => window.clearInterval(timer);
  }, [hasSlider, paused, slides.length]);

  if (!activeSlide) {
    return (
      <section
        aria-label={label}
        className="flex min-h-[calc(100svh-5rem)] items-center justify-center bg-[var(--sf-color-surface)] px-6 text-center"
      >
        <div>
          <p className="text-xs tracking-[0.24em] text-[var(--sf-color-muted)]" dir="ltr">
            HAMIDIAN SILVER
          </p>
          <h1 className="mt-5 text-[clamp(2.5rem,6vw,5.5rem)] font-normal">نقره حمیدیان</h1>
          <Link
            href="/products"
            className="mt-8 inline-flex min-h-11 items-center border border-[var(--sf-color-ink)] px-7 text-sm"
          >
            مشاهده محصولات
          </Link>
        </div>
      </section>
    );
  }

  const showCopy = Boolean(
    activeSlide.title ||
    activeSlide.subtitle ||
    (activeSlide.actionLabel && activeSlide.actionHref),
  );

  return (
    <section
      aria-label={label}
      aria-roledescription={hasSlider ? 'carousel' : undefined}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      style={{ color: activeSlide.contentColor }}
      className={`relative isolate overflow-hidden bg-black ${compact ? 'min-h-[70svh]' : 'min-h-[calc(100svh-5rem)]'}`}
    >
      {slides.map((slide, index) =>
        slide.media.url ? (
          <ResponsiveHeroImage
            key={`${slide.media.url}-${slide.mobileMedia?.url ?? ''}-${index}`}
            desktopSrc={slide.media.url}
            mobileSrc={slide.mobileMedia?.url}
            alt={slide.media.altText ?? slide.title ?? ''}
            preload={preload && index === 0}
            ariaHidden={index !== activeIndex}
            className={`object-cover transition-opacity duration-700 ${index === activeIndex ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
          />
        ) : null,
      )}
      <div className="absolute inset-0 -z-0 bg-gradient-to-t from-black/60 via-black/5 to-black/10" />

      {showCopy ? (
        <div className="absolute inset-x-0 bottom-[10%] z-10 mx-auto flex max-w-3xl flex-col items-center px-6 text-center">
          {activeSlide.title ? (
            <h1 className="text-[clamp(2rem,5vw,4.75rem)] leading-tight font-normal drop-shadow-sm">
              {activeSlide.title}
            </h1>
          ) : null}
          {activeSlide.subtitle ? (
            <p className="mt-4 max-w-2xl text-sm leading-7 opacity-90 sm:text-lg">
              {activeSlide.subtitle}
            </p>
          ) : null}
          {activeSlide.actionLabel && activeSlide.actionHref ? (
            <div className="mt-7">
              <HeroAction href={activeSlide.actionHref} label={activeSlide.actionLabel} />
            </div>
          ) : null}
        </div>
      ) : null}

      {hasSlider ? (
        <>
          <button
            type="button"
            aria-label="اسلاید قبلی"
            onClick={() =>
              setActiveIndex((current) => (current - 1 + slides.length) % slides.length)
            }
            className="absolute start-4 top-1/2 z-20 flex size-11 -translate-y-1/2 items-center justify-center border border-current bg-black/15 opacity-70 transition-[background-color,opacity] hover:bg-black/40 hover:opacity-100 sm:start-8"
          >
            <FiChevronRight aria-hidden="true" className="size-6" />
          </button>
          <button
            type="button"
            aria-label="اسلاید بعدی"
            onClick={() => setActiveIndex((current) => (current + 1) % slides.length)}
            className="absolute end-4 top-1/2 z-20 flex size-11 -translate-y-1/2 items-center justify-center border border-current bg-black/15 opacity-70 transition-[background-color,opacity] hover:bg-black/40 hover:opacity-100 sm:end-8"
          >
            <FiChevronLeft aria-hidden="true" className="size-6" />
          </button>
          <div className="absolute inset-x-0 bottom-5 z-20 flex justify-center gap-2">
            {slides.map((_, index) => (
              <button
                key={index}
                type="button"
                aria-label={`نمایش اسلاید ${index + 1}`}
                aria-current={index === activeIndex ? 'true' : undefined}
                onClick={() => setActiveIndex(index)}
                className={`h-1 bg-current transition-all ${index === activeIndex ? 'w-10 opacity-100' : 'w-5 opacity-50 hover:opacity-80'}`}
              />
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
