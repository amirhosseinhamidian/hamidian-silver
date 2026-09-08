import { ContentPagesView } from '@/components/content-pages/content-pages-view';
import { Badge } from '@/components/ui/badge';
import { requireAdminSession } from '@/lib/auth/session';
import { loadContentPages } from '@/lib/content-pages/content-pages-data';
import { formatAdminInteger } from '@/lib/presentation/formatters';

export const dynamic = 'force-dynamic';

export default async function ContentPage() {
  const user = await requireAdminSession({ permissions: ['cms.read'], returnTo: '/content' });
  const data = await loadContentPages();

  return (
    <main className="admin-container py-6 sm:py-8 lg:py-10">
      <header className="border-b border-[var(--admin-color-border)] pb-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="info">مرحله {formatAdminInteger(33)}</Badge>
          <Badge tone="neutral">محتوای صفحات Storefront</Badge>
        </div>
        <h1 className="mt-3 text-2xl font-black sm:text-3xl">مدیریت محتوای صفحات</h1>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--admin-color-muted)]">
          متن، تصویر، بخش‌های محتوایی و اطلاعات SEO صفحات عمومی فروشگاه را ویرایش کنید.
        </p>
      </header>
      <div className="pt-6">
        <ContentPagesView {...data} canWrite={user.permissions.includes('cms.write')} />
      </div>
    </main>
  );
}
