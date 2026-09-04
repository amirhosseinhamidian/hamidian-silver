import type { components } from '@hamidian/contracts';

type CatalogHeroProps = {
  settings: components['schemas']['PublicSiteSettingsDto'];
  devFallbackSrc?: string | null;
};

const DEFAULT_TITLE = 'محصولات نقره حمیدیان';

export function CatalogHero({ settings, devFallbackSrc }: CatalogHeroProps) {
  const configuredImage = settings.catalogHeroEnabled ? settings.catalogHeroMedia?.url : null;
  const image = configuredImage ?? devFallbackSrc ?? null;
  const title = settings.catalogHeroEnabled ? (settings.catalogHeroTitle ?? DEFAULT_TITLE) : DEFAULT_TITLE;
  const subtitle = settings.catalogHeroEnabled ? settings.catalogHeroSubtitle : null;

  if (!image) {
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
        relative isolate min-h-[18rem] overflow-hidden
        bg-[var(--sf-color-surface)]
        sm:min-h-[24rem] lg:min-h-[30rem]
      "
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image}
        alt={configuredImage ? (settings.catalogHeroMedia?.altText ?? '') : ''}
        className="
          absolute inset-0 -z-20
          h-full w-full object-cover
        "
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
          sf-container flex min-h-[inherit]
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
