'use client';

import Script from 'next/script';
import { Suspense, useEffect, useState, useSyncExternalStore } from 'react';

import { AnalyticsPageView } from '@/components/analytics/analytics-page-view';
import { WebVitalsReporter } from '@/components/analytics/web-vitals-reporter';
import {
  analyticsConsentSince,
  setAnalyticsConsent,
  subscribeToAnalyticsConsent,
} from '@/lib/analytics/analytics-consent';
import {
  initializeGoogleAnalytics,
  setGoogleAnalyticsEnabled,
  validGoogleMeasurementId,
} from '@/lib/analytics/google-analytics';

function serverConsent() {
  return null;
}

function useAnalyticsConsent() {
  return useSyncExternalStore(subscribeToAnalyticsConsent, analyticsConsentSince, serverConsent);
}

export function GoogleAnalytics({ measurementId }: Readonly<{ measurementId: string }>) {
  const allowed = useAnalyticsConsent() !== null;

  useEffect(() => {
    setGoogleAnalyticsEnabled(measurementId, allowed);
    if (allowed) initializeGoogleAnalytics(measurementId);
  }, [allowed, measurementId]);

  if (!allowed) return null;
  return (
    <>
      <Script
        id="google-analytics-library"
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
      <Suspense fallback={null}>
        <AnalyticsPageView />
      </Suspense>
      <WebVitalsReporter />
    </>
  );
}

export function AnalyticsPrivacySettings() {
  const allowed = useAnalyticsConsent() !== null;
  const [error, setError] = useState(false);

  return (
    <section
      aria-labelledby="analytics-privacy-title"
      className="mt-12 max-w-3xl border-t border-[var(--sf-color-border)] pt-8"
    >
      <h2 id="analytics-privacy-title" className="text-2xl font-normal">
        تنظیمات آمار بازدید
      </h2>
      <p
        id="analytics-privacy-description"
        className="mt-3 text-sm leading-7 text-[var(--sf-color-muted)]"
      >
        آمار اختیاری بازدید و خرید به بهبود فروشگاه کمک می‌کند. با اجازهٔ تو، اطلاعات برچسب کمپین یا
        دامنهٔ ارجاع در همین مرورگر برای سنجش منبع سفارش نگه داشته می‌شود. فروشگاه برای گزارش رشد،
        رویدادهای فهرست و سبد، گروه دستگاه و شناسهٔ موقت نشست را تا ۹۳ روز نگه می‌دارد. هنگام ثبت
        سفارش، گروه کلی دستگاه نیز در گزارش سفارش ثبت می‌شود. اگر Google Analytics فعال باشد، بخشی
        از آمار به گوگل ارسال می‌شود. می‌توانی هر زمان ثبت آمار را متوقف کنی.
      </p>
      <label className="mt-4 flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          className="size-4"
          aria-describedby="analytics-privacy-description"
          checked={allowed}
          onChange={(event) => {
            const next = event.target.checked;
            const measurementId = validGoogleMeasurementId(
              process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
            );
            if (!next && measurementId) setGoogleAnalyticsEnabled(measurementId, false);
            setError(!setAnalyticsConsent(next));
          }}
        />
        اجازهٔ ثبت آمار بازدید و خرید
      </label>
      {error ? (
        <p role="alert" className="mt-3 text-sm">
          ذخیرهٔ انتخاب در این مرورگر ممکن نبود.
        </p>
      ) : null}
    </section>
  );
}
