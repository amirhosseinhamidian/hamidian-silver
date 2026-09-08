export type SiteMedia = Readonly<{
  id: string;
  url: string | null;
  mimeType: string;
  altText: string | null;
}>;

export type SiteAnnouncement = Readonly<{
  enabled: boolean;
  message: string | null;
  countdownMode: 'NONE' | 'FIXED' | 'DEADLINE';
  durationSeconds: number | null;
  endsAt: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
}>;

export type AdminSiteSettings = Readonly<{
  headerCategoryIds: readonly string[];
  announcement: SiteAnnouncement;
  catalogHeroEnabled: boolean;
  catalogHeroTitle: string | null;
  catalogHeroSubtitle: string | null;
  catalogHeroMediaId: string | null;
  catalogHeroMedia: Omit<SiteMedia, 'id' | 'mimeType'> | null;
  galleryName: string | null;
  footerAbout: string | null;
  contactAddress: string | null;
  contactPhoneNumbers: readonly string[];
  contactEmail: string | null;
  instagramUrl: string | null;
  telegramUrl: string | null;
  baleUrl: string | null;
  updatedAt: string | null;
}>;

export type AdminHomepageSlide = Readonly<{
  id: string;
  mediaId: string;
  media: SiteMedia;
  title: string | null;
  subtitle: string | null;
  actionLabel: string | null;
  actionHref: string | null;
  sortOrder: number;
  isActive: boolean;
}>;

export type AdminHomepageSettings = Readonly<{
  primaryHeroSlides: readonly AdminHomepageSlide[];
  secondaryHero: AdminHomepageSlide | null;
  categoryIds: readonly string[];
  popularProductIds: readonly string[];
  updatedAt: string | null;
}>;

export type SiteSettingsReference = Readonly<{
  id: string;
  label: string;
}>;

type UnknownRecord = Record<string, unknown>;

const COUNTDOWN_MODES = new Set<SiteAnnouncement['countdownMode']>([
  'NONE',
  'FIXED',
  'DEADLINE',
]);

function record(value: unknown): UnknownRecord | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function nullableText(value: unknown): string | null | undefined {
  return value === null ? null : typeof value === 'string' ? value.trim() || null : undefined;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function stringArray(value: unknown): readonly string[] | null {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) return null;
  return value as string[];
}

function parseMedia(value: unknown): SiteMedia | null {
  const source = record(value);
  const id = text(source?.id);
  const mimeType = text(source?.mimeType);
  const url = nullableText(source?.url);
  const altText = nullableText(source?.altText);
  if (!source || !id || !mimeType || url === undefined || altText === undefined) return null;
  return { id, mimeType, url, altText };
}

function parseAnnouncement(value: unknown): SiteAnnouncement | null {
  const source = record(value);
  const mode = text(source?.countdownMode) as SiteAnnouncement['countdownMode'] | null;
  const message = nullableText(source?.message);
  const ctaLabel = nullableText(source?.ctaLabel);
  const ctaHref = nullableText(source?.ctaHref);
  const endsAt = nullableText(source?.endsAt);
  const duration = source?.durationSeconds === null ? null : finiteNumber(source?.durationSeconds);
  if (
    !source ||
    typeof source.enabled !== 'boolean' ||
    !mode ||
    !COUNTDOWN_MODES.has(mode) ||
    message === undefined ||
    ctaLabel === undefined ||
    ctaHref === undefined ||
    endsAt === undefined ||
    (duration === null && source.durationSeconds !== null)
  ) {
    return null;
  }
  return {
    enabled: source.enabled,
    message,
    countdownMode: mode,
    durationSeconds: duration,
    endsAt,
    ctaLabel,
    ctaHref,
  };
}

export function parseAdminSiteSettings(value: unknown): AdminSiteSettings | null {
  const source = record(value);
  const headerCategoryIds = stringArray(source?.headerCategoryIds);
  const announcement = parseAnnouncement(source?.announcement);
  const phones = stringArray(source?.contactPhoneNumbers);
  const fields = [
    nullableText(source?.catalogHeroTitle),
    nullableText(source?.catalogHeroSubtitle),
    nullableText(source?.galleryName),
    nullableText(source?.footerAbout),
    nullableText(source?.contactAddress),
    nullableText(source?.contactEmail),
    nullableText(source?.instagramUrl),
    nullableText(source?.telegramUrl),
    nullableText(source?.baleUrl),
    nullableText(source?.updatedAt),
  ];
  const mediaId = nullableText(source?.catalogHeroMediaId);
  const rawMedia = source?.catalogHeroMedia;
  const mediaSource = rawMedia === null ? null : record(rawMedia);
  const mediaUrl = mediaSource ? nullableText(mediaSource.url) : null;
  const mediaAltText = mediaSource ? nullableText(mediaSource.altText) : null;

  if (
    !source ||
    !headerCategoryIds ||
    !announcement ||
    !phones ||
    fields.some((field) => field === undefined) ||
    mediaId === undefined ||
    typeof source.catalogHeroEnabled !== 'boolean' ||
    (rawMedia !== null && (!mediaSource || mediaUrl === undefined || mediaAltText === undefined))
  ) {
    return null;
  }

  return {
    headerCategoryIds,
    announcement,
    catalogHeroEnabled: source.catalogHeroEnabled,
    catalogHeroTitle: fields[0]!,
    catalogHeroSubtitle: fields[1]!,
    catalogHeroMediaId: mediaId,
    catalogHeroMedia: mediaSource ? { url: mediaUrl!, altText: mediaAltText! } : null,
    galleryName: fields[2]!,
    footerAbout: fields[3]!,
    contactAddress: fields[4]!,
    contactPhoneNumbers: phones,
    contactEmail: fields[5]!,
    instagramUrl: fields[6]!,
    telegramUrl: fields[7]!,
    baleUrl: fields[8]!,
    updatedAt: fields[9]!,
  };
}

function parseSlide(value: unknown): AdminHomepageSlide | null {
  const source = record(value);
  const id = text(source?.id);
  const mediaId = text(source?.mediaId);
  const media = parseMedia(source?.media);
  const sortOrder = finiteNumber(source?.sortOrder);
  const fields = [
    nullableText(source?.title),
    nullableText(source?.subtitle),
    nullableText(source?.actionLabel),
    nullableText(source?.actionHref),
  ];
  if (
    !source ||
    !id ||
    !mediaId ||
    !media ||
    sortOrder === null ||
    typeof source.isActive !== 'boolean' ||
    fields.some((field) => field === undefined)
  ) {
    return null;
  }
  return {
    id,
    mediaId,
    media,
    title: fields[0]!,
    subtitle: fields[1]!,
    actionLabel: fields[2]!,
    actionHref: fields[3]!,
    sortOrder,
    isActive: source.isActive,
  };
}

export function parseAdminHomepageSettings(value: unknown): AdminHomepageSettings | null {
  const source = record(value);
  if (!source || !Array.isArray(source.primaryHeroSlides)) return null;
  const slides = source.primaryHeroSlides.map(parseSlide);
  const secondary = source.secondaryHero === null ? null : parseSlide(source.secondaryHero);
  const categories = Array.isArray(source.featuredCategories)
    ? source.featuredCategories.map((item) => text(record(item)?.id))
    : null;
  const products = Array.isArray(source.popularProducts)
    ? source.popularProducts.map((item) => text(record(item)?.id))
    : null;
  const updatedAt = nullableText(source.updatedAt);
  if (
    slides.some((slide) => slide === null) ||
    (secondary === null && source.secondaryHero !== null) ||
    !categories ||
    categories.some((id) => !id) ||
    !products ||
    products.some((id) => !id) ||
    updatedAt === undefined
  ) {
    return null;
  }
  return {
    primaryHeroSlides: slides as AdminHomepageSlide[],
    secondaryHero: secondary,
    categoryIds: categories as string[],
    popularProductIds: products as string[],
    updatedAt,
  };
}

export function parseSiteMedia(value: unknown): SiteMedia | null {
  return parseMedia(value);
}

export function parseCategoryReferences(value: unknown): readonly SiteSettingsReference[] | null {
  if (!Array.isArray(value)) return null;
  const items = value.map((entry) => {
    const source = record(entry);
    const id = text(source?.id);
    const label = text(source?.name);
    return id && label ? { id, label } : null;
  });
  return items.some((item) => item === null) ? null : (items as SiteSettingsReference[]);
}

export function parseProductReferences(value: unknown): readonly SiteSettingsReference[] | null {
  const source = record(value);
  const items = Array.isArray(source?.items) ? source.items : Array.isArray(value) ? value : null;
  if (!items) return null;
  const parsed = items.map((entry) => {
    const product = record(entry);
    const id = text(product?.id);
    const label = text(product?.name);
    return id && label ? { id, label } : null;
  });
  return parsed.some((item) => item === null) ? null : (parsed as SiteSettingsReference[]);
}
