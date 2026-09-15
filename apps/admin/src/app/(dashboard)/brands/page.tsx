import { ReferenceManagementView } from '@/components/catalog-references/reference-management-view';
import { Badge } from '@/components/ui/badge';
import { requireAdminSession } from '@/lib/auth/session';
import { loadReferenceManagement } from '@/lib/catalog/catalog-data';
import { formatAdminInteger } from '@/lib/presentation/formatters';

export const dynamic = 'force-dynamic';

export default async function BrandsPage() {
  const user = await requireAdminSession({ permissions: ['catalog.read'], returnTo: '/brands' });
  const data = await loadReferenceManagement();
  return (
    <main className="admin-container py-6 sm:py-8 lg:py-10">
      <header className="border-b border-[var(--admin-color-border)] pb-6">
        <Badge tone="info">مرحله {formatAdminInteger(9)}</Badge>
        <h1 className="mt-3 text-2xl font-black sm:text-3xl">مدیریت برندها و کشورها</h1>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-[var(--admin-color-muted)]">
          اطلاعات پایه، تصویر و وضعیت برندها و کشورهای سازنده محصولات را مدیریت کنید.
        </p>
      </header>
      <ReferenceManagementView
        brands={data.brands.data ?? []}
        countries={data.countries.data ?? []}
        brandsFailed={data.brands.failed}
        countriesFailed={data.countries.failed}
        canWrite={user.permissions.includes('catalog.write')}
      />
    </main>
  );
}
