'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FiArrowLeft } from 'react-icons/fi';

import {
  getFixedCountdownStorageKey,
  getInitialCountdownSeconds,
  resolveFixedCountdownDeadline,
  type StorefrontAnnouncement,
} from '@/components/layout/storefront-announcement-config';

export type {
  StorefrontAnnouncement,
  StorefrontAnnouncementCountdown,
} from '@/components/layout/storefront-announcement-config';

type StorefrontAnnouncementBarProps = Readonly<{
  announcement?: StorefrontAnnouncement | null;
  initialRemainingSeconds?: number | null;
}>;

const numberFormatter = new Intl.NumberFormat('fa-IR', {
  minimumIntegerDigits: 2,
  useGrouping: false,
});

function Countdown({
  announcement,
  initialSeconds,
}: Readonly<{ announcement: StorefrontAnnouncement; initialSeconds: number }>) {
  const [remainingSeconds, setRemainingSeconds] = useState(initialSeconds);

  useEffect(() => {
    if (initialSeconds <= 0) {
      return;
    }

    const now = Date.now();
    let clientDeadline = now + initialSeconds * 1000;

    if (announcement.countdown.mode === 'fixed') {
      const storageKey = getFixedCountdownStorageKey(announcement);

      if (storageKey) {
        try {
          const resolution = resolveFixedCountdownDeadline(
            window.localStorage.getItem(storageKey),
            announcement.countdown.durationSeconds,
            now,
          );
          clientDeadline = resolution.deadlineMs;
          if (resolution.shouldPersist) {
            window.localStorage.setItem(storageKey, String(resolution.deadlineMs));
          }
        } catch {
          clientDeadline =
            now +
            (getInitialCountdownSeconds(announcement.countdown, now) ?? initialSeconds) * 1000;
        }
      }
    } else if (announcement.countdown.mode === 'deadline') {
      const absoluteDeadline = Date.parse(announcement.countdown.endsAt);
      if (!Number.isNaN(absoluteDeadline)) clientDeadline = absoluteDeadline;
    }

    const updateRemainingSeconds = () => {
      setRemainingSeconds(Math.max(0, Math.ceil((clientDeadline - Date.now()) / 1000)));
    };
    const initialUpdateId = window.setTimeout(updateRemainingSeconds, 0);
    const intervalId = window.setInterval(() => {
      updateRemainingSeconds();
    }, 1000);

    return () => {
      window.clearTimeout(initialUpdateId);
      window.clearInterval(intervalId);
    };
  }, [announcement, initialSeconds]);

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
      className="inline-flex items-baseline gap-2 text-xs sm:text-sm"
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
          gap-x-5 gap-y-2 text-center text-sm leading-6
        "
      >
        <span>{announcement.message}</span>

        {initialRemainingSeconds !== null ? (
          <Countdown announcement={announcement} initialSeconds={initialRemainingSeconds} />
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
