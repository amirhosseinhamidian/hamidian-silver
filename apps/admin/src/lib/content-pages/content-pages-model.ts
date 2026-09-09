export const CONTENT_PAGE_KEYS = [
  'ABOUT',
  'CONTACT',
  'SERVICES',
  'TERMS',
  'PRIVACY',
  'SIZE_GUIDE',
  'FAQ',
] as const;

export type ContentPageKey = (typeof CONTENT_PAGE_KEYS)[number];

export type ContentPageMedia = Readonly<{
  url: string | null;
  altText: string | null;
  width: number | null;
  height: number | null;
}>;

export type ContentPageSection = Readonly<{ title: string; body: string | null }>;

export type AdminContentPage = Readonly<{
  key: ContentPageKey;
  title: string;
  eyebrow: string | null;
  subtitle: string | null;
  body: string | null;
  heroMediaId: string | null;
  heroMedia: ContentPageMedia | null;
  sections: readonly ContentPageSection[];
  seoTitle: string | null;
  seoDescription: string | null;
  seoCanonicalPath: string | null;
  seoNoIndex: boolean;
  seoOgMediaId: string | null;
  seoOgMedia: ContentPageMedia | null;
  updatedByUserId: string | null;
  updatedAt: string | null;
}>;

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function nullableText(value: unknown): string | null | undefined {
  return value === null ? null : typeof value === 'string' ? value : undefined;
}

function nullableNumber(value: unknown): number | null | undefined {
  return value === null
    ? null
    : typeof value === 'number' && Number.isFinite(value)
      ? value
      : undefined;
}

function nullableBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function isKey(value: unknown): value is ContentPageKey {
  return CONTENT_PAGE_KEYS.some((key) => key === value);
}

function media(value: unknown): ContentPageMedia | null | undefined {
  if (value === null) return null;
  const source = record(value);
  const url = nullableText(source?.url);
  const altText = nullableText(source?.altText);
  const width = nullableNumber(source?.width);
  const height = nullableNumber(source?.height);
  if (
    !source ||
    url === undefined ||
    altText === undefined ||
    width === undefined ||
    height === undefined
  ) {
    return undefined;
  }
  return { url, altText, width, height };
}

function section(value: unknown): ContentPageSection | null {
  const source = record(value);
  const title = text(source?.title);
  const body = nullableText(source?.body);
  return source && title && body !== undefined ? { title, body } : null;
}

function page(value: unknown): AdminContentPage | null {
  const source = record(value);
  const key = source?.key;
  const title = text(source?.title);
  const fields = [
    nullableText(source?.eyebrow),
    nullableText(source?.subtitle),
    nullableText(source?.body),
    nullableText(source?.heroMediaId),
    nullableText(source?.seoTitle),
    nullableText(source?.seoDescription),
    nullableText(source?.seoCanonicalPath),
    nullableText(source?.seoOgMediaId),
    nullableText(source?.updatedByUserId),
    nullableText(source?.updatedAt),
  ];
  const heroMedia = media(source?.heroMedia);
  const seoOgMedia = media(source?.seoOgMedia);
  const seoNoIndex = nullableBoolean(source?.seoNoIndex);
  const sections = Array.isArray(source?.sections) ? source.sections.map(section) : null;
  if (
    !source ||
    !isKey(key) ||
    !title ||
    fields.some((field) => field === undefined) ||
    heroMedia === undefined ||
    seoOgMedia === undefined ||
    seoNoIndex === undefined ||
    !sections ||
    sections.some((item) => item === null)
  ) {
    return null;
  }
  return {
    key,
    title,
    eyebrow: fields[0]!,
    subtitle: fields[1]!,
    body: fields[2]!,
    heroMediaId: fields[3]!,
    heroMedia,
    sections: sections as ContentPageSection[],
    seoTitle: fields[4]!,
    seoDescription: fields[5]!,
    seoCanonicalPath: fields[6]!,
    seoNoIndex,
    seoOgMediaId: fields[7]!,
    seoOgMedia,
    updatedByUserId: fields[8]!,
    updatedAt: fields[9]!,
  };
}

export function parseAdminContentPage(value: unknown): AdminContentPage | null {
  return page(value);
}

export function parseAdminContentPages(value: unknown): readonly AdminContentPage[] | null {
  if (!Array.isArray(value)) return null;
  const pages = value.map(page);
  if (pages.some((item) => item === null)) return null;
  const keys = new Set(pages.map((item) => item?.key));
  return keys.size === CONTENT_PAGE_KEYS.length ? (pages as AdminContentPage[]) : null;
}
