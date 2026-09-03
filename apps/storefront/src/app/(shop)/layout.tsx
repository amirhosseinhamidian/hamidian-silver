import { StorefrontShell } from '@/components/layout/storefront-shell';
import type { ReactNode } from 'react';

type ShopLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function ShopLayout({ children }: ShopLayoutProps) {
  return <StorefrontShell>{children}</StorefrontShell>;
}
