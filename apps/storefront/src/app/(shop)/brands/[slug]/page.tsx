import { notFound } from 'next/navigation';

import { CatalogCollectionPage } from '@/components/catalog/catalog-collection-page';
import {
  getPublicCatalogBrands,
  getPublicCatalogProducts,
  parseCatalogSearchParams,
  type CatalogFilters,
  type CatalogSearchParams,
} from '@/lib/catalog/public-catalog';

type BrandPageProps = Readonly<{
  params: Promise<{ slug: string }>;
  searchParams: Promise<CatalogSearchParams>;
}>;

export default async function BrandPage({ params, searchParams }: BrandPageProps) {
  const [{ slug }, parsedFilters] = await Promise.all([
    params,
    searchParams.then(parseCatalogSearchParams),
  ]);
  const filters: CatalogFilters = {
    page: parsedFilters.page,
    pageSize: parsedFilters.pageSize,
    sort: parsedFilters.sort,
    brand: slug,
  };

  const [brands, products] = await Promise.all([
    getPublicCatalogBrands(),
    getPublicCatalogProducts(filters),
  ]);
  const brand = brands.find((candidate) => candidate.slug === slug);

  if (!brand) {
    notFound();
  }

  return (
    <CatalogCollectionPage
      path={`/brands/${brand.slug}`}
      eyebrow="برند"
      title={brand.name}
      description={brand.description}
      image={brand.image}
      filters={filters}
      products={products}
    />
  );
}
