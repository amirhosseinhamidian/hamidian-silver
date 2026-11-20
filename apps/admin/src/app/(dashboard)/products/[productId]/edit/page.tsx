import { notFound } from 'next/navigation';

import { ProductForm } from '@/components/products/product-form';
import { ProductTypedAttributes } from '@/components/catalog-attributes/product-typed-attributes';
import { ProductMediaManager } from '@/components/products/product-media-manager';
import { ProductMerchandisingForm } from '@/components/products/product-merchandising-form';
import { ProductVariantManager } from '@/components/products/product-variant-manager';
import { Badge } from '@/components/ui/badge';
import { requireAdminSession } from '@/lib/auth/session';
import {
  loadProductForm,
  loadProductMerchandising,
  loadProductTypedAttributes,
} from '@/lib/catalog/catalog-data';
import { formatAdminInteger } from '@/lib/presentation/formatters';

type EditProductPageProps = Readonly<{ params: Promise<{ productId: string }> }>;

export const dynamic = 'force-dynamic';

export default async function EditProductPage({ params }: EditProductPageProps) {
  const { productId } = await params;
  await requireAdminSession({
    permissions: ['catalog.write'],
    returnTo: `/products/${productId}/edit`,
  });
  const [data, attributes, merchandising] = await Promise.all([
    loadProductForm(productId),
    loadProductTypedAttributes(productId),
    loadProductMerchandising(productId),
  ]);
  if (!data?.product) notFound();

  return (
    <main className="admin-container py-6 sm:py-8 lg:py-10">
      <header>
        <Badge tone="info">مرحله {formatAdminInteger(7)}</Badge>
        <h1 className="mt-3 text-2xl font-black sm:text-3xl">ویرایش {data.product.name}</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--admin-color-muted)]">
          اطلاعات کاتالوگ و قیمت محصول را به‌روزرسانی کنید.
        </p>
      </header>
      <div className="mt-6">
        <ProductMediaManager
          productId={data.product.id}
          productName={data.product.name}
          media={data.product.media}
        />
      </div>
      <ProductVariantManager product={data.product} sizes={data.sizes} />
      <ProductForm data={data} mode="edit" />
      <ProductMerchandisingForm
        productId={productId}
        settings={merchandising.data}
        published={data.product.status === 'ACTIVE'}
      />
      <ProductTypedAttributes
        productId={productId}
        items={attributes.data ?? []}
        failed={attributes.failed}
      />
    </main>
  );
}
