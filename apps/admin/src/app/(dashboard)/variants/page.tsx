import { VariantManagementView } from '@/components/products/variant-management-view';
import { hasAllAdminPermissions } from '@/lib/auth/access-control';
import { requireAdminSession } from '@/lib/auth/session';
import { loadVariantManagement } from '@/lib/catalog/catalog-data';
import { parseCatalogFilters } from '@/lib/catalog/catalog-model';

type VariantsPageProps = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

export const dynamic = 'force-dynamic';

export default async function VariantsPage({ searchParams }: VariantsPageProps) {
  const user = await requireAdminSession({ permissions: ['catalog.read'], returnTo: '/variants' });
  const filters = parseCatalogFilters(await searchParams);
  const data = await loadVariantManagement(filters);

  return (
    <VariantManagementView
      data={data}
      filters={filters}
      canWrite={hasAllAdminPermissions(user, ['catalog.write'])}
    />
  );
}
