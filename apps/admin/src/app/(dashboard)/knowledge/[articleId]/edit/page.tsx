import { notFound } from 'next/navigation';
import { GuideForm } from '@/components/guide/guide-form';
import { requireAdminSession } from '@/lib/auth/session';
import { loadGuideForm } from '@/lib/guide/guide-data';

export const dynamic = 'force-dynamic';
type Props = Readonly<{ params: Promise<{ articleId: string }> }>;

export default async function EditKnowledgePage({ params }: Props) {
  const { articleId } = await params;
  await requireAdminSession({
    permissions: ['cms.write'],
    returnTo: `/knowledge/${articleId}/edit`,
  });
  const data = await loadGuideForm(articleId);
  if (!data?.article) notFound();
  return (
    <main className="admin-container py-6 sm:py-8 lg:py-10">
      <GuideForm article={data.article} references={data.references} />
    </main>
  );
}
