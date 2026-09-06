import { cookies } from 'next/headers';

import { StorefrontShell } from '@/components/layout/storefront-shell';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import type { ReactNode } from 'react';

type ShopLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default async function ShopLayout({ children }: ShopLayoutProps) {
  const authenticated = Boolean((await cookies()).get(SESSION_COOKIE_NAME)?.value);

  return <StorefrontShell authenticated={authenticated}>{children}</StorefrontShell>;
}
