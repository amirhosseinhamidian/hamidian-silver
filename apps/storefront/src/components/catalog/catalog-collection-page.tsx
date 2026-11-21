import Link from 'next/link';

import { CatalogFacetedListing } from '@/components/catalog/catalog-faceted-listing';
import { CampaignBanner } from '@/components/home/campaign-banner';
import type { PublicCampaignBanner } from '@/lib/home/public-campaign-banner';
import { RelatedKnowledgeSection } from '@/components/guide/related-knowledge-section';
import { ResponsiveHeroImage } from '@/components/media/responsive-hero-image';
import { StorefrontBreadcrumbs } from '@/components/seo/storefront-breadcrumbs';
import { getCatalogDevProductImageSources } from '@/lib/catalog/dev-media.server';
import type {
  CatalogFacetFilters,
  CatalogFacetScope,
  CatalogListing,
} from '@/lib/catalog/catalog-filter-state';
import type { PublicCatalogMedia } from '@/lib/catalog/public-catalog';
import type { PublicGuideArticleSummary } from '@/lib/guide/public-guide';

type CatalogCollectionPageProps = Readonly<{
  path: string;
  eyebrow: string;
  title: string;
  description: string | null;
  image: PublicCatalogMedia | null;
  mobileImage: PublicCatalogMedia | null;
  filters: CatalogFacetFilters;
  scope: CatalogFacetScope;
  products: CatalogListing;
  campaignBanner?: PublicCampaignBanner | null;
  breadcrumbs?: readonly Readonly<{ label: string; href: string }>[];
  collectionLinks?: readonly Readonly<{
    label: string;
    href: string;
    activeSubtreeProductCount?: number;
  }>[];
  contextLinkGroups?: readonly Readonly<{
    label: string;
    links: readonly Readonly<{ label: string; href: string }>[];
  }>[];
  knowledgeArticles?: readonly PublicGuideArticleSummary[];
}>;

const persianNumber = new Intl.NumberFormat('fa-IR');

function CollectionHero({
  path,
  eyebrow,
  title,
  description,
  image,
  mobileImage,
  breadcrumbs,
}: Pick<
  CatalogCollectionPageProps,
  'path' | 'eyebrow' | 'title' | 'description' | 'image' | 'mobileImage' | 'breadcrumbs'
>) {
  const parent = path.startsWith('/brands/')
    ? { label: 'برندها', href: '/brands' }
    : { label: 'محصولات', href: '/products' };
  const breadcrumbItems = breadcrumbs ?? [
    { label: 'خانه', href: '/' },
    parent,
    { label: title, href: path },
  ];
  const copy = (
    <div className="max-w-2xl">
      <StorefrontBreadcrumbs items={breadcrumbItems} className="opacity-80" />
      <p className="mt-6 text-sm opacity-75">{eyebrow}</p>
      <h1 className="mt-3 text-4xl font-normal sm:text-5xl lg:text-6xl">{title}</h1>
      {description ? <p className="mt-5 text-sm leading-8 opacity-80">{description}</p> : null}
    </div>
  );

  if (!image?.url) {
    return (
      <header className="sf-container pt-[var(--sf-section-space)]">
        <div className="text-[var(--sf-color-ink)]">{copy}</div>
      </header>
    );
  }

  return (
    <header className="relative isolate aspect-[1086/1448] overflow-hidden bg-[var(--sf-color-surface)] lg:aspect-[1942/809]">
      <ResponsiveHeroImage
        desktopSrc={image.url}
        mobileSrc={mobileImage?.url}
        alt={image.altText?.trim() || title}
        preload
        className="-z-20 object-cover"
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/65 via-black/15 to-black/5" />
      <div className="sf-container flex h-full items-end py-10 text-white sm:py-14">{copy}</div>
    </header>
  );
}

export function CatalogCollectionPage({
  path,
  eyebrow,
  title,
  description,
  image,
  mobileImage,
  filters,
  scope,
  products,
  campaignBanner,
  breadcrumbs,
  collectionLinks = [],
  contextLinkGroups = [],
  knowledgeArticles = [],
}: CatalogCollectionPageProps) {
  return (
    <main id="main-content">
      <CollectionHero
        path={path}
        eyebrow={eyebrow}
        title={title}
        description={description}
        image={image}
        mobileImage={mobileImage}
        breadcrumbs={breadcrumbs}
      />

      {campaignBanner && <CampaignBanner key={campaignBanner.endsAt} banner={campaignBanner} />}

      <div className="sf-container">
        {collectionLinks.length ? (
          <nav
            aria-label={`زیرمجموعه‌های ${title}`}
            className="flex flex-wrap gap-2 border-b border-[var(--sf-color-border)] py-6"
          >
            {collectionLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="border border-[var(--sf-color-border)] px-4 py-2 text-sm text-[var(--sf-color-muted)] transition-colors hover:border-[var(--sf-color-ink)] hover:text-[var(--sf-color-ink)]"
              >
                {item.label}
                {item.activeSubtreeProductCount === undefined
                  ? null
                  : ` · ${persianNumber.format(item.activeSubtreeProductCount)} محصول`}
              </Link>
            ))}
          </nav>
        ) : null}

        {contextLinkGroups.map((group) =>
          group.links.length ? (
            <nav
              key={group.label}
              aria-label={group.label}
              className="border-b border-[var(--sf-color-border)] py-5"
            >
              <p className="mb-3 text-xs font-medium text-[var(--sf-color-subtle)]">
                {group.label}
              </p>
              <ul className="flex flex-wrap gap-x-5 gap-y-2">
                {group.links.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="text-sm text-[var(--sf-color-muted)] underline-offset-4 hover:text-[var(--sf-color-ink)] hover:underline"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null,
        )}

        <CatalogFacetedListing
          path={path}
          filters={filters}
          scope={scope}
          listing={products}
          fallbackSources={getCatalogDevProductImageSources(products.items)}
          prioritizeFirstImage={!image?.url}
        />

        <RelatedKnowledgeSection
          articles={knowledgeArticles}
          eyebrow={`راهنمای مرتبط با ${title}`}
          title="پیش از انتخاب، بیشتر بدانید"
          headingId={`collection-knowledge-${path.replace(/[^a-z0-9]+/gi, '-')}`}
          className="border-t border-[var(--sf-color-border)] py-14 sm:py-20"
        />
      </div>
    </main>
  );
}
