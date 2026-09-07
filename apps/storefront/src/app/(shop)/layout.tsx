import { cookies } from 'next/headers';

import { StorefrontShell } from '@/components/layout/storefront-shell';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { getPublicSiteSettings } from '@/lib/site-settings/public-site-settings';
import type { ReactNode } from 'react';

type ShopLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default async function ShopLayout({ children }: ShopLayoutProps) {
  const authenticated = Boolean((await cookies()).get(SESSION_COOKIE_NAME)?.value);
  const settings = await getPublicSiteSettings();

  return (
    <StorefrontShell
      authenticated={authenticated}
      footerContent={{
        galleryName: settings.galleryName,
        about: settings.footerAbout,
        address: settings.contactAddress,
        phoneNumbers: settings.contactPhoneNumbers,
        email: settings.contactEmail,
        social: {
          instagram: settings.instagramUrl,
          telegram: settings.telegramUrl,
          bale: settings.baleUrl,
        },
      }}
    >
      {children}
    </StorefrontShell>
  );
}
