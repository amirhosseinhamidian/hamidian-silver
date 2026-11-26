import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { FestivalLanding } from '@/components/campaigns/festival-landing';
import { FestivalProducts } from '@/components/campaigns/festival-products';
import { getInitialCountdownSeconds } from '@/components/layout/storefront-announcement-config';
import {
  campaignFilterParams,
  campaignFilters,
  campaignPageHref,
  hasCampaignFilters,
} from '@/lib/campaigns/campaign-filters';
import { CatalogProductCard } from '@/components/catalog/catalog-product-card';
import { ProductRecommendations } from '@/components/catalog/product-recommendations';
import { StorefrontImage } from '@/components/media/storefront-image';
import { StorefrontBreadcrumbs } from '@/components/seo/storefront-breadcrumbs';
import { ButtonLink } from '@/components/ui/button';
import { getPublicCampaignLanding } from '@/lib/campaigns/public-campaigns';
import { buildStorefrontPageMetadata, type StorefrontSearchParams } from '@/lib/seo/metadata';
import { getPublicSiteSettings } from '@/lib/site-settings/public-site-settings';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<StorefrontSearchParams>;
};

const displayNumber = new Intl.NumberFormat('fa-IR');

function pageNumber(raw: StorefrontSearchParams['page']) {
  if (raw === undefined) return 1;
  if (typeof raw !== 'string' || !/^[1-9]\d{0,3}$/.test(raw) || Number(raw) > 1000) return null;
  return Number(raw);
}

async function readLanding(props: Props) {
  const [{ slug }, searchParams] = await Promise.all([props.params, props.searchParams]);
  const page = pageNumber(searchParams.page);
  if (!page || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 64) return null;
  const filters = campaignFilters(searchParams);
  const filterQuery = campaignFilterParams(filters).toString();
  const landing = await getPublicCampaignLanding(slug, page, filterQuery);
  return landing ? { landing, page, searchParams, filters, filterQuery } : null;
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const result = await readLanding(props);
  if (!result) return { title: 'کمپین یافت نشد', robots: { index: false, follow: false } };
  const { landing, searchParams, filters } = result;
  return buildStorefrontPageMetadata(await getPublicSiteSettings(), {
    pathname: `/campaigns/${landing.slug}`,
    searchParams,
    title: landing.title,
    description: landing.story.slice(0, 160),
    ...(hasCampaignFilters(filters) ? { seoCanonicalPath: `/campaigns/${landing.slug}` } : {}),
    seoNoIndex:
      landing.isFestival === true ||
      hasCampaignFilters(filters) ||
      landing.seoMode !== 'RECURRING' ||
      !landing.active ||
      landing.products.total === 0,
    fallbackMedia: landing.media,
  });
}

export default async function CampaignLandingPage(props: Props) {
  const result = await readLanding(props);
  if (!result) notFound();
  const { landing, page, filters, filterQuery } = result;
  const pathname = `/campaigns/${landing.slug}`;
  const hasProducts = landing.active && landing.products.total > 0;
  const historicalFestival = landing.isFestival === true && !landing.active;
  const visibleSlugs = landing.products.items.map(({ slug }) => slug);
  const recommendations = hasProducts && visibleSlugs.length > 0 && (
    <ProductRecommendations
      list="campaign_recommendations"
      sources={visibleSlugs.slice(0, 1)}
      excluded={visibleSlugs}
    />
  );
  if (landing.design && landing.campaignId && landing.endsAt) {
    return (
      <FestivalLanding
        design={landing.design}
        campaignId={landing.campaignId}
        publicationVersion={landing.publicationVersion}
        endsAt={landing.endsAt}
        initialSeconds={
          getInitialCountdownSeconds({ mode: 'deadline', endsAt: landing.endsAt }) ?? 0
        }
        title={landing.title}
        story={landing.story}
        pathname={pathname}
        recommendations={recommendations}
        breadcrumbs={
          <StorefrontBreadcrumbs
            items={[
              { label: 'خانه', href: '/' },
              { label: landing.title, href: pathname },
            ]}
          />
        }
      >
        <FestivalProducts
          key={`${pathname}?${filterQuery}:${page}`}
          filterCategories={landing.design.filterCategories}
          filterBrands={landing.design.filterBrands}
          slug={landing.slug}
          filters={filters}
          products={landing.products}
        />
      </FestivalLanding>
    );
  }
  const previousPage = campaignPageHref(pathname, filters, page - 1);
  const nextPage = campaignPageHref(pathname, filters, page + 1);

  return (
    <main id="main-content" className="sf-container pb-20 pt-7 sm:pt-10">
      <StorefrontBreadcrumbs
        items={[
          { label: 'خانه', href: '/' },
          { label: landing.title, href: pathname },
        ]}
      />
      <header className="mt-6 grid items-center overflow-hidden rounded-[var(--sf-radius-md)] bg-[var(--sf-color-surface)] lg:grid-cols-2">
        <div className="min-w-0 p-6 [overflow-wrap:anywhere] sm:p-10">
          <h1 className="text-3xl font-medium leading-snug sm:text-5xl">{landing.title}</h1>
          <p className="mt-5 whitespace-pre-line text-sm leading-8 text-[var(--sf-color-muted)]">
            {landing.story}
          </p>
          {historicalFestival && (
            <p className="mt-4 text-sm font-semibold">این نوبت جشنواره به پایان رسیده است.</p>
          )}
          {hasProducts ? (
            <ButtonLink href="#campaign-products" className="mt-6">
              دیدن محصولات مجموعه
            </ButtonLink>
          ) : (
            <ButtonLink href="/products" className="mt-6">
              مشاهدهٔ محصولات فروشگاه
            </ButtonLink>
          )}
        </div>
        {landing.media?.url && (
          <div className="relative aspect-[4/3] overflow-hidden">
            <StorefrontImage
              src={landing.media.url}
              alt={landing.media.altText ?? ''}
              fill
              sizes="(min-width: 1024px) 45vw, 100vw"
              className="object-cover"
            />
          </div>
        )}
      </header>

      {!historicalFestival && (
        <section
          id="campaign-products"
          aria-labelledby="campaign-products-title"
          className="mt-10 scroll-mt-20 sm:mt-16"
        >
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="campaign-products-title" className="text-xl font-medium sm:text-3xl">
              محصولات مجموعه
            </h2>
            {hasProducts && (
              <p className="text-sm text-[var(--sf-color-muted)]">
                {displayNumber.format(landing.products.total)} محصول
              </p>
            )}
          </div>
          {hasProducts ? (
            <>
              <ul className="grid grid-cols-2 gap-x-2 gap-y-6 md:grid-cols-3 lg:grid-cols-4">
                {landing.products.items.map((product) => (
                  <CatalogProductCard key={product.id} product={product} />
                ))}
              </ul>
              {landing.products.totalPages > 1 && (
                <nav
                  aria-label="صفحات مجموعه"
                  className="mt-8 flex flex-wrap items-center justify-center gap-3 text-sm"
                >
                  {page > 1 && (
                    <ButtonLink href={previousPage} variant="outline">
                      صفحهٔ قبل
                    </ButtonLink>
                  )}
                  <span>صفحهٔ {displayNumber.format(page)}</span>
                  {page < Math.min(landing.products.totalPages, 1000) && (
                    <ButtonLink href={nextPage} variant="outline">
                      صفحهٔ بعد
                    </ButtonLink>
                  )}
                </nav>
              )}
              {landing.ctaPath !== '/' && (
                <ButtonLink href={landing.ctaPath} variant="outline" className="mt-8">
                  {landing.ctaLabel}
                </ButtonLink>
              )}
            </>
          ) : (
            <p className="rounded-md border border-[var(--sf-color-border)] p-5 text-sm leading-7 text-[var(--sf-color-muted)]">
              {landing.active
                ? 'در حال حاضر محصول قابل خریدی در این مجموعه موجود نیست.'
                : 'این نوبت کمپین به پایان رسیده است.'}
            </p>
          )}
        </section>
      )}
      {recommendations}
    </main>
  );
}
