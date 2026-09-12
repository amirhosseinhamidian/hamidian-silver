'use client';

import { peyda } from '@/styles/fonts';

import ShopError from './(shop)/error';
import './globals.css';

export default function GlobalError({
  error,
  reset,
}: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return (
    <html lang="fa" dir="rtl" className={peyda.variable}>
      <head>
        <title>اختلال موقت | نقره حمیدیان</title>
        <meta name="robots" content="noindex,nofollow" />
      </head>
      <body>
        <ShopError error={error} reset={reset} fullPage />
      </body>
    </html>
  );
}
