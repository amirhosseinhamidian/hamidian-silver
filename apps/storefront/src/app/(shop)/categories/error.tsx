'use client';

import { CatalogRouteError } from '@/components/catalog/catalog-route-error';

export default function CategoriesError({
  reset,
}: Readonly<{
  error: Error;
  reset: () => void;
}>) {
  return <CatalogRouteError title="بارگذاری دسته‌بندی انجام نشد" reset={reset} />;
}
