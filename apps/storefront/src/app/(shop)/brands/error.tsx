'use client';

import { CatalogRouteError } from '@/components/catalog/catalog-route-error';

export default function BrandsError({
  reset,
}: Readonly<{
  error: Error;
  reset: () => void;
}>) {
  return <CatalogRouteError title="بارگذاری برندها انجام نشد" reset={reset} />;
}
