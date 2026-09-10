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

const FIXED_COUNTDOWN_STORAGE_PREFIX = 'hamidian:announcement-countdown:v1';

function normalizedDurationSeconds(durationSeconds: number): number {
  if (!Number.isFinite(durationSeconds)) return 0;
  return Math.max(0, Math.floor(durationSeconds));
}

function announcementFingerprint(value: string): string {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
}

export function getFixedCountdownStorageKey(
  announcement: StorefrontAnnouncement,
): string | null {
  if (announcement.countdown.mode !== 'fixed') return null;

  const identity = JSON.stringify({
    enabled: announcement.enabled,
    message: announcement.message.trim(),
    durationSeconds: normalizedDurationSeconds(announcement.countdown.durationSeconds),
    cta: announcement.cta
      ? {
          enabled: announcement.cta.enabled,
          label: announcement.cta.label.trim(),
          href: announcement.cta.href.trim(),
        }
      : null,
  });

  return `${FIXED_COUNTDOWN_STORAGE_PREFIX}:${announcementFingerprint(identity)}`;
}

export function resolveFixedCountdownDeadline(
  storedDeadline: string | null,
  durationSeconds: number,
  now = Date.now(),
): Readonly<{ deadlineMs: number; shouldPersist: boolean }> {
  const parsedDeadline = storedDeadline?.trim() ? Number(storedDeadline) : Number.NaN;

  if (Number.isFinite(parsedDeadline) && parsedDeadline >= 0) {
    return { deadlineMs: parsedDeadline, shouldPersist: false };
  }

  return {
    deadlineMs:
      now + getInitialCountdownSeconds({ mode: 'fixed', durationSeconds }, now)! * 1000,
    shouldPersist: true,
  };
}

export function getInitialCountdownSeconds(
  countdown: StorefrontAnnouncementCountdown,
  now = Date.now(),
): number | null {
  if (countdown.mode === 'none') {
    return null;
  }

  if (countdown.mode === 'fixed') {
    return normalizedDurationSeconds(countdown.durationSeconds) * 2;
  }

  const endsAt = Date.parse(countdown.endsAt);

  if (Number.isNaN(endsAt)) {
    return 0;
  }

  return Math.max(0, Math.ceil((endsAt - now) / 1000));
}
