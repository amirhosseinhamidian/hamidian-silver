import { SearchOverviewView } from '@/components/seo/search-overview-view';
import { requireAdminSession } from '@/lib/auth/session';
import { loadSearchOverview } from '@/lib/seo/search-overview-data';
import { readSearchOverviewFilters } from '@/lib/seo/search-overview-model';

type SearchOverviewPageProps = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

export const dynamic = 'force-dynamic';

export default async function SearchOverviewPage({ searchParams }: SearchOverviewPageProps) {
  await requireAdminSession({ permissions: ['settings.read'], returnTo: '/seo' });
  const filters = readSearchOverviewFilters(await searchParams);
  const data = await loadSearchOverview(filters);
  return <SearchOverviewView filters={filters} {...data} />;
}
