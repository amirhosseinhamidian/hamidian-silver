'use client';

import { CatalogRouteError } from '@/components/catalog/catalog-route-error';

type ProductsErrorProps = Readonly<{
  reset: () => void;
}>;

export default function ProductsError({ reset }: ProductsErrorProps) {
  return <CatalogRouteError title="دریافت اطلاعات محصولات ممکن نشد" reset={reset} />;
}
