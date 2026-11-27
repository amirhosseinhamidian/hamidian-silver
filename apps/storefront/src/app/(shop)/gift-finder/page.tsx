import type { Metadata } from 'next';

import { GiftFinderWizard } from '@/components/catalog/gift-finder-wizard';
import { ButtonLink } from '@/components/ui/button';
import { getPublicCampaignLanding } from '@/lib/campaigns/public-campaigns';
import {
  giftCollectionSlug,
  giftFinderFilters,
  giftFinderOptions,
  giftFinderPath,
  maxGiftBudgetToman,
} from '@/lib/catalog/gift-finder';
import { getPublicFacetedCatalog } from '@/lib/catalog/public-catalog';
import { buildStorefrontPageMetadata, type StorefrontSearchParams } from '@/lib/seo/metadata';
import { getPublicSiteSettings } from '@/lib/site-settings/public-site-settings';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return buildStorefrontPageMetadata(await getPublicSiteSettings(), {
    pathname: giftFinderPath,
    title: 'راهنمای انتخاب هدیه',
    description: 'محصول موجود برای هدیه را با توجه به بودجه، مناسبت و سلیقه پیدا کنید.',
  });
}

export default async function GiftFinderPage({
  searchParams,
}: Readonly<{ searchParams: Promise<StorefrontSearchParams> }>) {
  const slug = giftCollectionSlug((await searchParams).collection);
  const [listing, landing] = await Promise.all([
    getPublicFacetedCatalog({
      ...giftFinderFilters({ page: 1, budget: maxGiftBudgetToman }),
      pageSize: 1,
    }).catch(() => null),
    slug ? getPublicCampaignLanding(slug, 1, '', true).catch(() => null) : null,
  ]);
  const collection = landing?.active && landing.products.total > 0 ? landing : null;
  return (
    <main id="main-content" className="sf-container space-y-8 py-[var(--sf-section-space)]">
      <header className="max-w-2xl space-y-3">
        <h1 className="text-3xl font-medium sm:text-5xl">راهنمای انتخاب هدیه</h1>
        <p className="text-sm leading-7 text-[var(--sf-color-muted)]">
          بودجه و ترجیحاتتان را وارد کنید تا محصولات قابل خرید را ببینید.
        </p>
      </header>
      {listing && !listing.invalidFilters ? (
        <GiftFinderWizard options={giftFinderOptions(listing.facets)} />
      ) : (
        <div className="space-y-3">
          <p role="alert">دریافت گزینه‌های راهنمای هدیه انجام نشد.</p>
          <ButtonLink
            href={slug ? `${giftFinderPath}?collection=${slug}` : giftFinderPath}
            variant="outline"
          >
            تلاش دوباره
          </ButtonLink>
        </div>
      )}
      {collection && (
        <aside className="border-t border-[var(--sf-color-border)] pt-5">
          <ButtonLink href={`/campaigns/${collection.slug}`} variant="outline">
            دیدن {collection.title}
          </ButtonLink>
        </aside>
      )}
    </main>
  );
}
