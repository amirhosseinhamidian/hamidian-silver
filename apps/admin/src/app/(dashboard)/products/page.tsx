import { AdminProductsView } from '@/components/products/admin-products-view';
import { hasAllAdminPermissions } from '@/lib/auth/access-control';
import { requireAdminSession } from '@/lib/auth/session';
import { loadProductManagement } from '@/lib/catalog/catalog-data';
import { parseCatalogFilters } from '@/lib/catalog/catalog-model';

type ProductsPageProps = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

export const dynamic = 'force-dynamic';

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const user = await requireAdminSession({ permissions: ['catalog.read'], returnTo: '/products' });
  const filters = parseCatalogFilters(await searchParams);
  const data = await loadProductManagement(filters);

  return (
    <AdminProductsView
      data={data}
      filters={filters}
      canWrite={hasAllAdminPermissions(user, ['catalog.write'])}
    />
  );
}
