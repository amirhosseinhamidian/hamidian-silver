import { AttributeRegistry } from '@/components/catalog-attributes/attribute-registry';
import { requireAdminSession } from '@/lib/auth/session';
import { loadAttributeDefinitions, loadCategoryManagement } from '@/lib/catalog/catalog-data';

export const dynamic = 'force-dynamic';

export default async function CatalogAttributesPage() {
  const user = await requireAdminSession({
    permissions: ['catalog.read'],
    returnTo: '/catalog-attributes',
  });
  const [definitions, categories] = await Promise.all([
    loadAttributeDefinitions(),
    loadCategoryManagement(),
  ]);
  return (
    <main className="admin-container space-y-5 py-6 sm:py-8 lg:py-10">
      <h1 className="text-2xl font-black sm:text-3xl">ویژگی‌های ساختاریافتهٔ کاتالوگ</h1>
      <AttributeRegistry
        definitions={definitions.data ?? []}
        categories={categories.data ?? []}
        canWrite={user.permissions.includes('catalog.write')}
        failed={definitions.failed || categories.failed}
      />
    </main>
  );
}
