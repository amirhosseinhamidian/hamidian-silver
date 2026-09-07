import { notFound } from 'next/navigation';

import { ProductForm } from '@/components/products/product-form';
import { Badge } from '@/components/ui/badge';
import { requireAdminSession } from '@/lib/auth/session';
import { loadProductForm } from '@/lib/catalog/catalog-data';
import { formatAdminInteger } from '@/lib/presentation/formatters';

type EditProductPageProps = Readonly<{ params: Promise<{ productId: string }> }>;

export const dynamic = 'force-dynamic';

export default async function EditProductPage({ params }: EditProductPageProps) {
  const { productId } = await params;
  await requireAdminSession({
    permissions: ['catalog.write'],
    returnTo: `/products/${productId}/edit`,
  });
  const data = await loadProductForm(productId);
  if (!data?.product) notFound();

  return (
    <main className="admin-container py-6 sm:py-8 lg:py-10">
      <header>
        <Badge tone="info">مرحله {formatAdminInteger(5)}</Badge>
        <h1 className="mt-3 text-2xl font-black sm:text-3xl">ویرایش {data.product.name}</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--admin-color-muted)]">
          اطلاعات کاتالوگ و قیمت محصول را به‌روزرسانی کنید.
        </p>
      </header>
      <ProductForm data={data} mode="edit" />
    </main>
  );
}
