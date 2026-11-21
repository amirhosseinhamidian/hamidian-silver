import { SearchEntityListView } from '@/components/seo/search-entity-list-view';
import { requireAdminSession } from '@/lib/auth/session';
import { loadSearchEntityList } from '@/lib/seo/search-entity-data';
import { readEntityFilters } from '@/lib/seo/search-entity-model';

type Props = Readonly<{ searchParams: Promise<Record<string, string | string[] | undefined>> }>;
export const dynamic = 'force-dynamic';

export default async function SearchEntityListPage({ searchParams }: Props) {
  const user = await requireAdminSession({
    permissions: ['settings.read'],
    returnTo: '/seo/entities',
  });
  const filters = readEntityFilters(await searchParams);
  const result = await loadSearchEntityList(filters.list);
  return <SearchEntityListView filters={filters} permissions={user.permissions} {...result} />;
}
