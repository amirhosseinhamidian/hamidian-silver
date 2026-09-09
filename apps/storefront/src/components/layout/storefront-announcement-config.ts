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
