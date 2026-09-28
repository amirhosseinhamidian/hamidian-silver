import { SupplierProductImportsView } from '@/components/supplier-imports/supplier-product-imports-view';
import { Badge } from '@/components/ui/badge';
import { requireAdminSession } from '@/lib/auth/session';
import { loadSupplierImports } from '@/lib/supplier-imports/supplier-imports-data';

export const dynamic = 'force-dynamic';

export default async function ProductImportsPage() {
  const user = await requireAdminSession({
    permissions: ['catalog.read'],
    returnTo: '/product-imports',
  });
  const result = await loadSupplierImports();

  return (
    <main className="admin-container py-6 sm:py-8 lg:py-10">
      <header className="border-b border-[var(--admin-color-border)] pb-6">
        <Badge tone="info">ورود کنترل‌شده محصول</Badge>
        <h1 className="mt-3 text-2xl font-black sm:text-3xl">ورود محصولات تأمین‌کنندگان</h1>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--admin-color-muted)]">
          یک صفحه محصول را از سایت تأمین‌کننده دریافت کنید، اطلاعات و تصاویر آن را بازبینی کنید و
          پیش از ورود به کاتالوگ ویرایشش کنید.
        </p>
      </header>

      <SupplierProductImportsView
        sources={result.data?.sources ?? []}
        drafts={result.data?.drafts ?? []}
        categories={result.data?.categories ?? []}
        runs={result.data?.runs ?? []}
        failed={result.failed}
        canWrite={user.permissions.includes('catalog.write')}
      />
    </main>
  );
}
