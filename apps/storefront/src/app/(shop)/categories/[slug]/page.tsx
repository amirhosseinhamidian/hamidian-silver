import { notFound } from 'next/navigation';

import { CatalogCollectionPage } from '@/components/catalog/catalog-collection-page';
import {
  getPublicCatalogCategories,
  getPublicCatalogProducts,
  parseCatalogSearchParams,
  type CatalogFilters,
  type CatalogSearchParams,
} from '@/lib/catalog/public-catalog';

type CategoryPageProps = Readonly<{
  params: Promise<{ slug: string }>;
  searchParams: Promise<CatalogSearchParams>;
}>;

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const [{ slug }, parsedFilters] = await Promise.all([
    params,
    searchParams.then(parseCatalogSearchParams),
  ]);
  const filters: CatalogFilters = {
    page: parsedFilters.page,
    pageSize: parsedFilters.pageSize,
    sort: parsedFilters.sort,
    category: slug,
  };

  const [categories, products] = await Promise.all([
    getPublicCatalogCategories(),
    getPublicCatalogProducts(filters),
  ]);
  const category = categories.find((candidate) => candidate.slug === slug);

  if (!category) {
    notFound();
  }

  return (
    <CatalogCollectionPage
      path={`/categories/${category.slug}`}
      eyebrow="دسته‌بندی"
      title={category.name}
      description={category.description}
      image={category.image}
      filters={filters}
      products={products}
    />
  );
}
