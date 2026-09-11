import { StorefrontImage } from '@/components/media/storefront-image';
import { StorefrontBreadcrumbs } from '@/components/seo/storefront-breadcrumbs';
import {
  PUBLIC_CONTENT_PAGE_ROUTES,
  type PublicContentPage,
} from '@/lib/content/public-content-page';

type ContentPageHeroProps = Readonly<{
  page: PublicContentPage;
}>;

export function ContentPageHero({ page }: ContentPageHeroProps) {
  return (
    <header className="relative isolate flex min-h-[62svh] items-end overflow-hidden bg-[#151515] text-white sm:min-h-[72svh]">
      {page.heroMedia?.url ? (
        <StorefrontImage
          src={page.heroMedia.url}
          alt={page.heroMedia.altText ?? page.title}
          fill
          sizes="100vw"
          preload
          className="-z-20 object-cover"
        />
      ) : (
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_25%_20%,#575757_0,transparent_30%),linear-gradient(130deg,#090909,#292929_55%,#0d0d0d)]"
        />
      )}
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/75 via-black/15 to-black/10" />
      <div className="sf-container w-full pb-12 sm:pb-16 lg:pb-20">
        <div className="max-w-3xl">
          <StorefrontBreadcrumbs
            items={[
              { label: 'خانه', href: '/' },
              { label: page.title, href: PUBLIC_CONTENT_PAGE_ROUTES[page.key] },
            ]}
            className="mb-7 text-white/70"
          />
          {page.eyebrow ? (
            <p className="text-xs tracking-[0.16em] text-white/75 sm:text-sm">{page.eyebrow}</p>
          ) : null}
          <h1 className="mt-4 text-[clamp(2.6rem,7vw,6rem)] leading-[1.15] font-normal">
            {page.title}
          </h1>
          {page.subtitle ? (
            <p className="mt-5 max-w-2xl text-sm leading-8 text-white/85 sm:text-lg sm:leading-9">
              {page.subtitle}
            </p>
          ) : null}
        </div>
      </div>
    </header>
  );
}
