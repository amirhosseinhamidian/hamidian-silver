import type { Metadata } from 'next';
import Script from 'next/script';
import { Suspense, type ReactNode } from 'react';

import { AnalyticsPageView } from '@/components/analytics/analytics-page-view';
import {
  googleAnalyticsBootstrap,
  validGoogleMeasurementId,
} from '@/lib/analytics/google-analytics';
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
  const measurementId = validGoogleMeasurementId(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID);

  return (
    <html lang="fa" dir="rtl" className={peyda.variable}>
      <body>
        {children}
        {measurementId ? (
          <>
            <Script id="google-analytics-bootstrap" strategy="beforeInteractive">
              {googleAnalyticsBootstrap(measurementId)}
            </Script>
            <Script
              id="google-analytics-library"
              src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
              strategy="afterInteractive"
            />
            <Suspense fallback={null}>
              <AnalyticsPageView />
            </Suspense>
          </>
        ) : null}
      </body>
    </html>
  );
}
