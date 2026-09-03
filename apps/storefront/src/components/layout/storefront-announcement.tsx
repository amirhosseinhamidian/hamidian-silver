'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FiArrowLeft } from 'react-icons/fi';

export type StorefrontAnnouncementCountdown =
  | Readonly<{ mode: 'none' }>
  | Readonly<{ mode: 'fixed'; durationSeconds: number }>
  | Readonly<{ mode: 'deadline'; endsAt: string }>;

export type StorefrontAnnouncement = Readonly<{
  enabled: boolean;
  message: string;
  countdown: StorefrontAnnouncementCountdown;
  cta?: Readonly<{
    enabled: boolean;
    label: string;
    href: string;
  }>;
}>;

type StorefrontAnnouncementBarProps = Readonly<{
  announcement?: StorefrontAnnouncement | null;
  initialRemainingSeconds?: number | null;
}>;

const numberFormatter = new Intl.NumberFormat('fa-IR', {
  minimumIntegerDigits: 2,
  useGrouping: false,
});

export function getInitialCountdownSeconds(
  countdown: StorefrontAnnouncementCountdown,
  now = Date.now(),
): number | null {
  if (countdown.mode === 'none') {
    return null;
  }

  if (countdown.mode === 'fixed') {
    return Math.max(0, Math.floor(countdown.durationSeconds));
  }

  const endsAt = Date.parse(countdown.endsAt);

  if (Number.isNaN(endsAt)) {
    return 0;
  }

  return Math.max(0, Math.ceil((endsAt - now) / 1000));
}

function Countdown({ initialSeconds }: Readonly<{ initialSeconds: number }>) {
  const [remainingSeconds, setRemainingSeconds] = useState(initialSeconds);

  useEffect(() => {
    if (initialSeconds <= 0) {
      return;
    }

    const clientDeadline = Date.now() + initialSeconds * 1000;
    const intervalId = window.setInterval(() => {
      setRemainingSeconds(Math.max(0, Math.ceil((clientDeadline - Date.now()) / 1000)));
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [initialSeconds]);

  if (remainingSeconds <= 0) {
    return null;
  }

  const days = Math.floor(remainingSeconds / 86400);
  const hours = Math.floor((remainingSeconds % 86400) / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);
  const seconds = remainingSeconds % 60;

  return (
    <span
      aria-label="شمارش معکوس"
      dir="rtl"
      className="inline-flex items-baseline gap-2 text-[0.68rem] sm:text-xs"
    >
      <span>{numberFormatter.format(days)} روز</span>
      <span>{numberFormatter.format(hours)} ساعت</span>
      <span>{numberFormatter.format(minutes)} دقیقه</span>
      <span>{numberFormatter.format(seconds)} ثانیه</span>
    </span>
  );
}

export function StorefrontAnnouncementBar({
  announcement,
  initialRemainingSeconds = null,
}: StorefrontAnnouncementBarProps) {
  if (!announcement?.enabled || !announcement.message.trim()) {
    return null;
  }

  const cta =
    announcement.cta?.enabled && announcement.cta.label.trim() && announcement.cta.href.trim()
      ? announcement.cta
      : null;

  return (
    <div
      className="
        bg-[var(--sf-color-ink)] px-4 py-2 text-[var(--sf-color-inverse)]
      "
    >
      <div
        className="
          sf-container flex min-h-7 flex-wrap items-center justify-center
          gap-x-5 gap-y-2 text-center text-xs
        "
      >
        <span>{announcement.message}</span>

        {initialRemainingSeconds !== null ? (
          <Countdown initialSeconds={initialRemainingSeconds} />
        ) : null}

        {cta ? (
          <Link
            href={cta.href}
            className="
              inline-flex items-center gap-1.5 border-b border-current pb-0.5
              font-medium
            "
          >
            {cta.label}
            <FiArrowLeft aria-hidden="true" size={14} />
          </Link>
        ) : null}
      </div>
    </div>
  );
}
