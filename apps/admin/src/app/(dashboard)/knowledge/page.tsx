import { GuideManagementView } from '@/components/guide/guide-management-view';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { requireAdminSession } from '@/lib/auth/session';
import { loadGuideManagement } from '@/lib/guide/guide-data';
import type { GuideArticleFormat, GuideArticleStatus, GuideFilters } from '@/lib/guide/guide-model';

export const dynamic = 'force-dynamic';

type Props = Readonly<{ searchParams: Promise<Record<string, string | string[] | undefined>> }>;
const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? (value[0] ?? '') : (value ?? '');

export default async function KnowledgePage({ searchParams }: Props) {
  const user = await requireAdminSession({ permissions: ['cms.read'], returnTo: '/knowledge' });
  const params = await searchParams;
  const page = Math.max(1, Number(first(params.page)) || 1);
  const limit = Math.min(48, Math.max(1, Number(first(params.limit)) || 20));
  const statusValue = first(params.status);
  const formatValue = first(params.format);
  const filters: GuideFilters = {
    q: first(params.q).trim(),
    status: (['DRAFT', 'PUBLISHED', 'ARCHIVED'].includes(statusValue) ? statusValue : '') as
      GuideArticleStatus | '',
    format: (['GUIDE', 'ANSWER', 'BUYING_GUIDE', 'CARE_GUIDE', 'COMPARISON', 'STORY'].includes(
      formatValue,
    )
      ? formatValue
      : '') as GuideArticleFormat | '',
    topic: first(params.topic).trim() === 'all' ? '' : first(params.topic).trim(),
    page,
    limit,
  };
  const data = await loadGuideManagement(filters);
  const canWrite = user.permissions.includes('cms.write');
  return (
    <main className="admin-container py-6 sm:py-8 lg:py-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Badge tone="info">مدیریت محتوا</Badge>
          <h1 className="mt-3 text-2xl font-black sm:text-3xl">دانستنی‌ها</h1>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--admin-color-muted)]">
            پاسخ پرسش‌ها، راهنمای خرید و محتوای کاربردی برای شناخت و نگهداری محصولات.
          </p>
        </div>
        {canWrite ? <ButtonLink href="/knowledge/new">ساخت دانستنی</ButtonLink> : null}
      </header>
      <div className="pt-6">
        <GuideManagementView data={data} filters={filters} canWrite={canWrite} />
      </div>
    </main>
  );
}
