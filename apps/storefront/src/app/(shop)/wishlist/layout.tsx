import type { ReactNode } from 'react';

import { PRIVATE_STOREFRONT_METADATA } from '@/lib/seo/metadata';

export const metadata = PRIVATE_STOREFRONT_METADATA;

export default function WishlistLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <>{children}</>;
}
