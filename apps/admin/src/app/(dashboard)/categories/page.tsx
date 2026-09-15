import { CategoryManagementView } from '@/components/categories/category-management-view';
import { Badge } from '@/components/ui/badge';
import { requireAdminSession } from '@/lib/auth/session';
import { loadCategoryManagement } from '@/lib/catalog/catalog-data';
import { formatAdminInteger } from '@/lib/presentation/formatters';

export const dynamic = 'force-dynamic';

export default async function CategoriesPage() {
  const user = await requireAdminSession({
    permissions: ['catalog.read'],
    returnTo: '/categories',
  });
  const categories = await loadCategoryManagement();

  return (
    <main className="admin-container py-6 sm:py-8 lg:py-10">
      <header className="border-b border-[var(--admin-color-border)] pb-6">
        <Badge tone="info">مرحله {formatAdminInteger(8)}</Badge>
        <h1 className="mt-3 text-2xl font-black sm:text-3xl">مدیریت دسته‌بندی‌ها</h1>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-[var(--admin-color-muted)]">
          ساختار درختی، ترتیب نمایش و تصویر دسته‌های فروشگاه را مدیریت کنید.
        </p>
      </header>

      <CategoryManagementView
        categories={categories.data ?? []}
        failed={categories.failed}
        canWrite={user.permissions.includes('catalog.write')}
      />
    </main>
  );
}
