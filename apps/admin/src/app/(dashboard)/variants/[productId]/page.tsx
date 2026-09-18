import { notFound } from 'next/navigation';

import { ProductVariantManager } from '@/components/products/product-variant-manager';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { requireAdminSession } from '@/lib/auth/session';
import { loadProductForm } from '@/lib/catalog/catalog-data';
import { formatAdminInteger } from '@/lib/presentation/formatters';

type ProductVariantsPageProps = Readonly<{
  params: Promise<{ productId: string }>;
}>;

export const dynamic = 'force-dynamic';

export default async function ProductVariantsPage({ params }: ProductVariantsPageProps) {
  const { productId } = await params;
  await requireAdminSession({
    permissions: ['catalog.write'],
    returnTo: `/variants/${productId}`,
  });
  const data = await loadProductForm(productId);
  if (!data?.product) notFound();

  return (
    <main className="admin-container py-6 sm:py-8 lg:py-10">
      <header className="flex flex-col gap-4 border-b border-[var(--admin-color-border)] pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Badge tone="info">مدیریت تنوع محصول</Badge>
          <h1 className="mt-3 text-2xl font-black sm:text-3xl">تنوع‌های {data.product.name}</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--admin-color-muted)]">
            SKU، نام، سایز، وزن، قیمت و وضعیت تنوع‌های این محصول را مدیریت کنید.
          </p>
          <p className="mt-2 text-xs text-[var(--admin-color-subtle)]">
            {formatAdminInteger(data.product.variants.length)} تنوع ثبت‌شده
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/variants" variant="outline">
            بازگشت به تنوع‌ها
          </ButtonLink>
          <ButtonLink href={`/products/${data.product.id}/edit`} variant="outline">
            ویرایش محصول
          </ButtonLink>
        </div>
      </header>

      <div className="mt-6">
        <ProductVariantManager product={data.product} sizes={data.sizes} />
      </div>
    </main>
  );
}
