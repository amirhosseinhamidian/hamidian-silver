import { cache } from 'react';

import { createServerApiClient } from '@/lib/api/server-client';

export type PublicSiteSettings = Readonly<{
  headerCategories: readonly Readonly<{ id: string; label: string; slug: string }>[];
  announcement: Readonly<{
    enabled: boolean;
    message: string | null;
    countdownMode: 'NONE' | 'FIXED' | 'DEADLINE';
    durationSeconds: number | null;
    endsAt: string | null;
    ctaLabel: string | null;
    ctaHref: string | null;
  }>;
  catalogHeroEnabled: boolean;
  catalogHeroTitle: string | null;
  catalogHeroSubtitle: string | null;
  catalogHeroMedia: Readonly<{ url: string | null; altText: string | null }> | null;
  galleryName: string | null;
  footerAbout: string | null;
  contactAddress: string | null;
  contactPhoneNumbers: readonly string[];
  contactEmail: string | null;
  instagramUrl: string | null;
  telegramUrl: string | null;
  baleUrl: string | null;
}>;

const DEFAULT_PUBLIC_SITE_SETTINGS: PublicSiteSettings = {
  headerCategories: [],
  announcement: {
    enabled: false,
    message: null,
    countdownMode: 'NONE',
    durationSeconds: null,
    endsAt: null,
    ctaLabel: null,
    ctaHref: null,
  },
  catalogHeroEnabled: false,
  catalogHeroTitle: null,
  catalogHeroSubtitle: null,
  catalogHeroMedia: null,
  galleryName: null,
  footerAbout: null,
  contactAddress: null,
  contactPhoneNumbers: [],
  contactEmail: null,
  instagramUrl: null,
  telegramUrl: null,
  baleUrl: null,
};

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function nullableText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function parsePublicSettings(value: unknown): PublicSiteSettings | null {
  const source = record(value);
  const announcement = record(source?.announcement);
  if (!source || !announcement || typeof source.catalogHeroEnabled !== 'boolean') return null;
  const mode = nullableText(announcement.countdownMode);
  if (mode !== 'NONE' && mode !== 'FIXED' && mode !== 'DEADLINE') return null;

  const rawCategories = Array.isArray(source.headerCategories) ? source.headerCategories : [];
  const headerCategories = rawCategories.flatMap((entry) => {
    const category = record(entry);
    const id = nullableText(category?.id);
    const label = nullableText(category?.label);
    const slug = nullableText(category?.slug);
    return id && label && slug ? [{ id, label, slug }] : [];
  });
  if (headerCategories.length !== rawCategories.length) return null;

  const rawPhones = Array.isArray(source.contactPhoneNumbers) ? source.contactPhoneNumbers : [];
  if (rawPhones.some((phone) => typeof phone !== 'string')) return null;
  const rawMedia = source.catalogHeroMedia;
  const media = rawMedia === null ? null : record(rawMedia);
  if (rawMedia !== null && !media) return null;

  return {
    headerCategories,
    announcement: {
      enabled: announcement.enabled === true,
      message: nullableText(announcement.message),
      countdownMode: mode,
      durationSeconds:
        typeof announcement.durationSeconds === 'number' &&
        Number.isFinite(announcement.durationSeconds)
          ? announcement.durationSeconds
          : null,
      endsAt: nullableText(announcement.endsAt),
      ctaLabel: nullableText(announcement.ctaLabel),
      ctaHref: nullableText(announcement.ctaHref),
    },
    catalogHeroEnabled: source.catalogHeroEnabled,
    catalogHeroTitle: nullableText(source.catalogHeroTitle),
    catalogHeroSubtitle: nullableText(source.catalogHeroSubtitle),
    catalogHeroMedia: media
      ? { url: nullableText(media.url), altText: nullableText(media.altText) }
      : null,
    galleryName: nullableText(source.galleryName),
    footerAbout: nullableText(source.footerAbout),
    contactAddress: nullableText(source.contactAddress),
    contactPhoneNumbers: rawPhones as string[],
    contactEmail: nullableText(source.contactEmail),
    instagramUrl: nullableText(source.instagramUrl),
    telegramUrl: nullableText(source.telegramUrl),
    baleUrl: nullableText(source.baleUrl),
  };
}

export const getPublicSiteSettings = cache(async (): Promise<PublicSiteSettings> => {
  const apiOrigin = process.env.HAMIDIAN_API_ORIGIN;
  if (!apiOrigin) return DEFAULT_PUBLIC_SITE_SETTINGS;

  try {
    const client = createServerApiClient({ apiOrigin });
    const result = await client.GET('/api/v1/site-settings/public', { cache: 'no-store' });
    if (!result.response.ok || !result.data) return DEFAULT_PUBLIC_SITE_SETTINGS;
    return parsePublicSettings(result.data) ?? DEFAULT_PUBLIC_SITE_SETTINGS;
  } catch {
    return DEFAULT_PUBLIC_SITE_SETTINGS;
  }
});
