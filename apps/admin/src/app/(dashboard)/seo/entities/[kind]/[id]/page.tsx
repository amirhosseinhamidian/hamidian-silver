import { notFound } from 'next/navigation';
import { SearchEntityDetailView } from '@/components/seo/search-entity-detail-view';
import { requireAdminSession } from '@/lib/auth/session';
import { loadSearchEntityDetail } from '@/lib/seo/search-entity-data';
import { entityIdPattern, entityKinds, readEntityFilters } from '@/lib/seo/search-entity-model';

type Props = Readonly<{
  params: Promise<{ kind: string; id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;
export const dynamic = 'force-dynamic';

export default async function SearchEntityDetailPage({ params, searchParams }: Props) {
  const { kind: value, id } = await params;
  const kind = entityKinds.find(([entry]) => entry === value)?.[0];
  if (!kind || !entityIdPattern.test(id)) notFound();
  const user = await requireAdminSession({
    permissions: ['settings.read'],
    returnTo: `/seo/entities/${kind}/${id}`,
  });
  const filters = readEntityFilters(await searchParams);
  const result = await loadSearchEntityDetail(kind, id, filters.detail);
  if (result.status === 404 && !filters.detail.urlId) notFound();
  return (
    <SearchEntityDetailView
      kind={kind}
      filters={filters}
      permissions={user.permissions}
      {...result}
    />
  );
}
