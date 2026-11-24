'use client';

import Link from 'next/link';
import { useEffect, useState, type CSSProperties } from 'react';
import { CampaignArtwork } from '@/components/home/campaign-artwork';
import { useCampaignVisibility } from '@/lib/campaigns/campaign-visibility';
import type { PublicCampaignBanner } from '@/lib/home/public-campaign-banner';
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
  campaign?: PublicCampaignBanner | null;
  campaignSeconds?: number;
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

function countdownTextBackground(color: string) {
  const rgb = color
    .slice(1)
    .match(/../g)
    ?.map((value) => Number.parseInt(value, 16) / 255);
  if (!rgb || rgb.length !== 3) return '#161616';
  const [red, green, blue] = rgb.map((value) =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue >= 0.179 ? '#000000' : '#ffffff';
}

export function StorefrontAnnouncementBar({
  announcement,
  initialRemainingSeconds = null,
  campaign,
  campaignSeconds = 0,
}: StorefrontAnnouncementBarProps) {
  const campaignVisible = useCampaignVisibility(campaign?.campaignId, campaign?.endsAt);
  if (campaign && campaignVisible && campaignSeconds > 0) {
    const campaignAnnouncement: StorefrontAnnouncement = {
      enabled: true,
      message: campaign.message,
      countdown: { mode: 'deadline', endsAt: campaign.endsAt },
    };
    const color = campaign.textColor ?? '#ffffff';
    const backgroundColor = countdownTextBackground(color);
    const heights = {
      '--campaign-height': `${campaign.mobileHeight ?? 88}px`,
      '--campaign-desktop-height': `${campaign.desktopHeight ?? 96}px`,
    } as CSSProperties;

    return (
      <aside aria-label={campaign.name} className="relative isolate" style={heights}>
        <CampaignArtwork
          key={`${campaign.media?.url}:${campaign.mobileMedia?.url}:${campaign.stillMedia?.url}`}
          artwork={campaign}
          sizes="100vw"
          className="absolute inset-0 -z-10"
        />
        <div className="bg-[var(--sf-color-ink)] absolute inset-0 -z-20" aria-hidden="true" />
        <div className="sf-container pointer-events-none relative flex min-h-[var(--campaign-height)] items-center justify-center py-2 sm:min-h-[var(--campaign-desktop-height)]">
          <div
            className="pointer-events-auto flex flex-wrap items-center justify-center gap-x-5 gap-y-2 rounded-sm px-4 py-2 text-center text-sm leading-6 [overflow-wrap:anywhere]"
            style={{ color, backgroundColor }}
          >
            <span>{campaign.message || campaign.name}</span>
            <Countdown announcement={campaignAnnouncement} initialSeconds={campaignSeconds} />
            {campaign.ctaPath && campaign.ctaLabel && (
              <Link href={campaign.ctaPath} className="border-b border-current font-semibold">
                {campaign.ctaLabel}
              </Link>
            )}
          </div>
        </div>
      </aside>
    );
  }

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
