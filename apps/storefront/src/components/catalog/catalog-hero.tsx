import type { components } from '@hamidian/contracts';

import { ResponsiveHeroImage } from '@/components/media/responsive-hero-image';

type CatalogHeroProps = {
  settings: Pick<
    components['schemas']['PublicSiteSettingsDto'],
    | 'catalogHeroEnabled'
    | 'catalogHeroTitle'
    | 'catalogHeroSubtitle'
    | 'catalogHeroMedia'
    | 'catalogHeroMobileMedia'
  >;
  devFallbackSrc?: string | null;
};

const DEFAULT_TITLE = 'محصولات نقره حمیدیان';

export function CatalogHero({ settings, devFallbackSrc }: CatalogHeroProps) {
  const configuredDesktopImage = settings.catalogHeroEnabled
    ? settings.catalogHeroMedia?.url
    : null;
  const configuredMobileImage = settings.catalogHeroEnabled
    ? settings.catalogHeroMobileMedia?.url
    : null;
  const desktopImage = configuredDesktopImage ?? devFallbackSrc ?? null;
  const title = settings.catalogHeroEnabled
    ? (settings.catalogHeroTitle ?? DEFAULT_TITLE)
    : DEFAULT_TITLE;
  const subtitle = settings.catalogHeroEnabled ? settings.catalogHeroSubtitle : null;

  if (!desktopImage) {
    return (
      <header className="sf-container pt-[var(--sf-section-space)]">
        <p className="text-sm text-[var(--sf-color-muted)]">کاتالوگ فروشگاه</p>
        <h1 className="mt-3 text-4xl font-normal sm:text-5xl">{title}</h1>
        {subtitle ? (
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--sf-color-muted)]">
            {subtitle}
          </p>
        ) : null}
      </header>
    );
  }

  return (
    <section
      className="
        relative isolate aspect-[1086/1448] overflow-hidden
        bg-[var(--sf-color-surface)]
        lg:aspect-[1942/809]
      "
    >
      <ResponsiveHeroImage
        desktopSrc={desktopImage}
        mobileSrc={configuredMobileImage ?? desktopImage}
        alt={configuredDesktopImage ? (settings.catalogHeroMedia?.altText ?? '') : ''}
        preload
        className="-z-20 object-cover"
      />

      <div
        className="
          absolute inset-0 -z-10
          bg-gradient-to-t
          from-black/55
          via-black/10
          to-transparent
        "
      />

      <div
        className="
          sf-container flex h-full
          items-end py-10 text-white
          sm:py-14
        "
      >
        <div className="max-w-2xl">
          <p className="text-xs text-white/75">کاتالوگ فروشگاه</p>

          <h1 className="mt-3 text-4xl font-normal sm:text-5xl lg:text-6xl">{title}</h1>

          {subtitle ? (
            <p className="mt-4 max-w-xl text-sm leading-7 text-white/80">{subtitle}</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
