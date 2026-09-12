'use client';

import { AdminErrorState } from '@/components/ui/admin-error-state';
import { vazirmatn } from '@/styles/fonts';

import './globals.css';

export default function GlobalError({
  reset,
}: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return (
    <html lang="fa" dir="rtl" className={vazirmatn.variable}>
      <head>
        <title>اختلال موقت | پنل نقره حمیدیان</title>
        <meta name="robots" content="noindex,nofollow" />
      </head>
      <body>
        <AdminErrorState
          fullPage
          title="پنل مدیریت موقتاً در دسترس نیست"
          description="اتصال سرویس را بررسی کنید و دوباره تلاش کنید. اگر مشکل ادامه داشت، با پشتیبانی فنی تماس بگیرید."
          onRetry={reset}
        />
      </body>
    </html>
  );
}
