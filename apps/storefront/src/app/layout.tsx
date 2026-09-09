import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { buildStorefrontRootMetadata } from '@/lib/seo/metadata';
import { getPublicSiteSettings } from '@/lib/site-settings/public-site-settings';
import { peyda } from '@/styles/fonts';

import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  return buildStorefrontRootMetadata(await getPublicSiteSettings());
}

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="fa" dir="rtl" className={peyda.variable}>
      <body>{children}</body>
    </html>
  );
}
