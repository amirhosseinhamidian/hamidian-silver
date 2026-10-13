import { GuideForm } from '@/components/guide/guide-form';
import { requireAdminSession } from '@/lib/auth/session';
import { loadGuideForm } from '@/lib/guide/guide-data';

export const dynamic = 'force-dynamic';

export default async function NewKnowledgePage() {
  await requireAdminSession({ permissions: ['cms.write'], returnTo: '/knowledge/new' });
  const data = await loadGuideForm();
  return (
    <main className="admin-container py-6 sm:py-8 lg:py-10">
      {data ? (
        <GuideForm article={null} references={data.references} />
      ) : (
        <p role="alert" className="text-sm text-[var(--admin-color-danger)]">
          اطلاعات لازم برای ساخت دانستنی دریافت نشد.
        </p>
      )}
    </main>
  );
}
