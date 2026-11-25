'use client';

import type { components } from '@hamidian/contracts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, type CSSProperties, type ReactNode } from 'react';
import { CatalogMedia } from '@/components/catalog/catalog-media';
import { CatalogProductCard } from '@/components/catalog/catalog-product-card';
import { CampaignArtwork } from '@/components/home/campaign-artwork';
import { HomepageHero } from '@/components/home/homepage-hero';
import { Countdown } from '@/components/layout/storefront-announcement';
import { formatTomanPrice } from '@/lib/catalog/presentation';
import { campaignPageHref } from '@/lib/campaigns/campaign-filters';
import { useCampaignVisibility } from '@/lib/campaigns/campaign-visibility';

type Design = components['schemas']['PublicFestivalDesignDto'];
type Section = components['schemas']['PublicFestivalSectionDto'];

function FestivalSectionContent({ section, pathname }: { section: Section; pathname: string }) {
  if (section.categories?.length) {
    return (
      <ul
        className={
          section.layout === 'STRIP'
            ? 'grid auto-cols-[minmax(10rem,40%)] grid-flow-col gap-3 overflow-x-auto overscroll-x-contain pb-3 md:auto-cols-[22%]'
            : 'grid grid-cols-2 gap-3 md:grid-cols-4'
        }
      >
        {section.categories.map(({ name, slug, media }) => (
          <li key={slug}>
            <Link
              href={`${campaignPageHref(pathname, { scopeCategory: slug })}#campaign-products`}
              className="block overflow-hidden rounded-lg border border-current/20 bg-[var(--sf-color-surface)]"
            >
              <span className="relative block aspect-[4/3] overflow-hidden">
                <CatalogMedia
                  media={media ? { ...media, width: null, height: null } : null}
                  alt={name}
                  sizes="(min-width: 768px) 22vw, 48vw"
                />
              </span>
              <span className="block p-3 font-medium">{name}</span>
            </Link>
          </li>
        ))}
      </ul>
    );
  }

  const productGrid = section.products?.length ? (
    <ul
      className={
        section.layout === 'STRIP'
          ? 'grid auto-cols-[minmax(10rem,40%)] grid-flow-col gap-3 overflow-x-auto overscroll-x-contain pb-3 md:auto-cols-[22%]'
          : 'grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4'
      }
    >
      {section.products.map((product) => (
        <CatalogProductCard key={product.id} product={product} variant="festival" />
      ))}
    </ul>
  ) : null;

  if (section.entries?.length) {
    if (section.kind === 'FAQ') {
      return (
        <div className={section.layout === 'STRIP' ? 'grid gap-2 sm:grid-cols-2' : 'space-y-2'}>
          {section.entries.map(({ title, body }, index) => (
            <details
              key={index}
              className="rounded-lg border border-current/20 bg-[var(--sf-color-surface)] p-4"
            >
              <summary className="cursor-pointer font-medium">{title}</summary>
              <p className="mt-3 whitespace-pre-line text-sm leading-7">{body}</p>
            </details>
          ))}
        </div>
      );
    }
    return (
      <div className="space-y-4">
        {productGrid}
        <ul
          className={
            section.layout === 'STRIP'
              ? 'flex flex-wrap gap-3'
              : 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3'
          }
        >
          {section.entries.map(({ title, body, maxPriceToman, actionPath }, index) => (
            <li
              key={index}
              className="rounded-lg border border-current/20 bg-[var(--sf-color-surface)] p-4"
            >
              {section.kind === 'BUDGET' && maxPriceToman ? (
                <Link
                  href={`${campaignPageHref(pathname, { maxPriceToman })}#campaign-products`}
                  className="font-semibold underline underline-offset-4"
                >
                  {title} · تا {formatTomanPrice(maxPriceToman)}
                </Link>
              ) : section.kind === 'OFFERS' && actionPath ? (
                <Link href={actionPath} className="font-semibold underline underline-offset-4">
                  {title}
                </Link>
              ) : (
                <h3 className="font-semibold">{title}</h3>
              )}
              {body && <p className="mt-2 whitespace-pre-line text-sm leading-7">{body}</p>}
            </li>
          ))}
        </ul>
      </div>
    );
  }
  return productGrid;
}

export function FestivalLanding({
  design,
  campaignId,
  endsAt,
  initialSeconds,
  title,
  story,
  pathname,
  children,
  preview = false,
  breadcrumbs,
}: {
  design: Design;
  campaignId: string;
  endsAt: string;
  initialSeconds: number;
  title: string;
  story: string;
  pathname: string;
  children?: ReactNode;
  breadcrumbs?: ReactNode;
  preview?: boolean;
}) {
  const visible = useCampaignVisibility(
    preview ? undefined : campaignId,
    preview ? undefined : endsAt,
  );
  const router = useRouter();
  const refreshAt = design.refreshAt;
  useEffect(() => {
    if (preview || !visible || !refreshAt) return;
    const change = Date.parse(refreshAt);
    if (!Number.isFinite(change)) return;
    let timer: number;
    function schedule() {
      const delay = change - Date.now();
      if (delay <= 0) router.refresh();
      else timer = window.setTimeout(schedule, Math.min(delay, 2_147_483_647));
    }
    timer = window.setTimeout(schedule, Math.min(Math.max(change - Date.now(), 0), 2_147_483_647));
    return () => window.clearTimeout(timer);
  }, [preview, refreshAt, router, visible]);
  const { theme } = design;
  const { card } = theme;
  const hero = design.sections.find(({ kind }) => kind === 'HERO');
  const hasIntro = design.sections.some(({ kind }) => kind === 'INTRO');
  const slides = hero?.slides?.filter((slide) => slide.media?.url) ?? [];
  const pattern =
    theme.decoration === 'DOTS'
      ? `radial-gradient(circle, ${theme.accent}24 1px, transparent 1px)`
      : theme.decoration === 'LINES'
        ? `repeating-linear-gradient(135deg, transparent 0 22px, ${theme.accent}18 22px 23px)`
        : undefined;
  const style = {
    '--sf-color-canvas': theme.background,
    '--sf-color-surface': theme.surface,
    '--sf-color-ink': theme.foreground,
    '--sf-color-subtle': theme.foreground,
    '--sf-color-muted': theme.foreground,
    '--sf-color-inverse': theme.background,
    '--festival-card-surface': card?.surface ?? theme.surface,
    '--festival-card-border': card?.border ?? theme.accent,
    '--festival-card-discount': card?.discount,
    '--festival-card-tag': card?.tag,
    '--festival-card-price': card?.price,
    '--festival-card-quota': card?.quota,
    '--festival-card-action': card?.action,
    color: theme.foreground,
    backgroundColor: theme.background,
    backgroundImage: [
      pattern,
      theme.gradient ? `linear-gradient(180deg, ${theme.gradient}, transparent 40%)` : undefined,
    ]
      .filter(Boolean)
      .join(', '),
    backgroundSize: theme.decoration === 'DOTS' ? '18px 18px, 100% 100%' : undefined,
  } as CSSProperties;

  if (!visible) {
    return (
      <main id="main-content" className="sf-container space-y-5 py-12">
        <h1 className="text-3xl">{title}</h1>
        <p>این کمپین در حال حاضر فعال نیست.</p>
        <Link href="/products" className="underline">
          مشاهدهٔ فروشگاه
        </Link>
      </main>
    );
  }

  const heading = (
    <div className="sf-container py-7">
      {breadcrumbs}
      {slides.length === 0 && <h1 className="my-4 text-3xl font-medium sm:text-5xl">{title}</h1>}
      {!hasIntro && <p className="mt-4 max-w-3xl whitespace-pre-line text-sm leading-8">{story}</p>}
    </div>
  );

  return (
    <main
      id="main-content"
      style={style}
      className="min-h-[35vh] pb-16"
      data-festival-card-density={card?.density === 'COMPACT' ? 'compact' : undefined}
      data-festival-card-shadow={card?.shadow === 'SOFT' ? 'soft' : undefined}
      data-festival-card-hover={card?.hoverEmphasis !== false ? 'emphasis' : undefined}
      data-festival-card-description={card?.showDescription === false ? 'hidden' : undefined}
    >
      {slides.length === 0 && heading}
      {design.sections.map((section) => {
        if (section.kind === 'HERO') {
          if (!slides.length) return null;
          return (
            <div key="HERO">
              <HomepageHero
                compact
                preload={!preview}
                autoPlay={theme.motion === 'SOFT'}
                fallbackTitle={title}
                label={section.title}
                slides={slides.map((slide) => ({
                  title: slide.title,
                  subtitle: slide.subtitle ?? null,
                  actionLabel: slide.actionLabel ?? 'محصولات جشنواره',
                  actionHref: slide.actionPath ?? '#campaign-products',
                  contentColor: '#ffffff',
                  media: slide.media,
                  mobileMedia: slide.mobileMedia,
                  festivalArtwork: slide,
                }))}
              />
              {heading}
            </div>
          );
        }
        if (section.kind === 'COUNTDOWN') {
          return (
            <aside
              key={section.kind}
              className="sticky top-16 z-30 border-y border-current/15 bg-[var(--sf-color-surface)]"
            >
              <div className="sf-container flex flex-wrap items-center justify-center gap-x-7 gap-y-2 py-3">
                <span className="text-sm font-medium">{section.title}</span>
                {initialSeconds > 0 ? (
                  <Countdown
                    large
                    announcement={{
                      enabled: true,
                      message: title,
                      countdown: { mode: 'deadline', endsAt },
                    }}
                    initialSeconds={initialSeconds}
                  />
                ) : (
                  <span>مهلت کمپین به پایان رسیده است.</span>
                )}
                <Link
                  href="#campaign-products"
                  className="text-sm font-medium underline underline-offset-4"
                >
                  محصولات
                </Link>
              </div>
            </aside>
          );
        }
        const all = section.kind === 'PRODUCTS';
        const hasArtwork = Boolean(
          section.artwork?.media?.url ||
          section.artwork?.mobileMedia?.url ||
          section.artwork?.stillMedia?.url,
        );
        if (
          !all &&
          !section.description &&
          !hasArtwork &&
          !section.products?.length &&
          !section.entries?.length &&
          !section.categories?.length
        ) {
          return preview ? (
            <section key={section.kind} className="sf-container py-5">
              <h2>{section.title}</h2>
              <p className="text-sm">این بخش هنوز محتوای واجد شرایط ندارد.</p>
            </section>
          ) : null;
        }
        return (
          <section
            key={section.kind}
            id={all ? 'campaign-products' : undefined}
            className="sf-container scroll-mt-32 pt-10 sm:pt-14"
          >
            <div
              className={
                section.highlighted
                  ? 'rounded-xl bg-[var(--sf-color-surface)] p-3 sm:p-6'
                  : undefined
              }
            >
              <h2
                className="mb-5 border-s-2 ps-3 text-xl font-semibold sm:text-3xl"
                style={{ borderColor: theme.accent }}
              >
                {section.title}
              </h2>
              {section.description && (
                <p className="mb-5 max-w-3xl whitespace-pre-line text-sm leading-8 [overflow-wrap:anywhere]">
                  {section.description}
                </p>
              )}
              {section.artwork && hasArtwork && (
                <CampaignArtwork
                  key={[
                    section.artwork.media?.id,
                    section.artwork.mobileMedia?.id,
                    section.artwork.stillMedia?.id,
                  ].join(':')}
                  artwork={section.artwork}
                  className="relative mb-5 aspect-[4/3] overflow-hidden rounded-lg sm:aspect-[3/1]"
                  sizes="100vw"
                />
              )}
              {all ? children : <FestivalSectionContent section={section} pathname={pathname} />}
            </div>
          </section>
        );
      })}
    </main>
  );
}
