import { ProductForm } from '@/components/products/product-form';
import { Badge } from '@/components/ui/badge';
import { requireAdminSession } from '@/lib/auth/session';
import { loadProductForm } from '@/lib/catalog/catalog-data';
import { formatAdminInteger } from '@/lib/presentation/formatters';

export const dynamic = 'force-dynamic';

export default async function NewProductPage() {
  await requireAdminSession({ permissions: ['catalog.write'], returnTo: '/products/new' });
  const data = await loadProductForm();

  return (
    <main className="admin-container py-6 sm:py-8 lg:py-10">
      <header>
        <Badge tone="info">مرحله {formatAdminInteger(5)}</Badge>
        <h1 className="mt-3 text-2xl font-black sm:text-3xl">افزودن محصول</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--admin-color-muted)]">
          اطلاعات پایه محصول را ثبت کنید؛ تصویر و تنوع‌های بیشتر در مراحل تخصصی قابل مدیریت هستند.
        </p>
      </header>
      {data ? (
        <ProductForm data={data} mode="create" />
      ) : (
        <p role="alert" className="mt-6 text-sm text-[var(--admin-color-danger)]">
          اطلاعات پایه کاتالوگ دریافت نشد. اتصال API را بررسی کنید.
        </p>
      )}
    </main>
  );
}
