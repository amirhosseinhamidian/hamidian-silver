import type { ProductRelationCandidate } from '@/lib/catalog/catalog-data';
import type { CatalogLookup } from '@/lib/catalog/catalog-model';
import type { SiteMedia } from '@/lib/site-settings/site-settings-model';

export type GuideArticleStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type GuideArticleFormat =
  'GUIDE' | 'ANSWER' | 'BUYING_GUIDE' | 'CARE_GUIDE' | 'COMPARISON' | 'STORY';
export type GuideBlockType =
  | 'LEAD'
  | 'RICH_TEXT'
  | 'IMAGE'
  | 'IMAGE_TEXT'
  | 'STEPS'
  | 'QUOTE'
  | 'TABLE'
  | 'FAQ'
  | 'GALLERY'
  | 'PRODUCT_CARDS'
  | 'CTA'
  | 'DIVIDER';

export type GuideTopic = Readonly<{
  id: string;
  name: string;
  slug: string;
  description: string | null;
  coverMedia: SiteMedia | null;
  seoTitle: string | null;
  seoDescription: string | null;
  seoCanonicalPath: string | null;
  seoNoIndex: boolean;
  sortOrder: number;
  isActive: boolean;
}>;

export type GuideArticleBlock = Readonly<{
  id: string;
  type: GuideBlockType;
  variant: string | null;
  anchorId: string | null;
  primaryMedia: SiteMedia | null;
  content: Readonly<Record<string, unknown>>;
  sortOrder: number;
}>;

export type GuideArticle = Readonly<{
  id: string;
  title: string;
  slug: string;
  eyebrow: string | null;
  excerpt: string | null;
  format: GuideArticleFormat;
  status: GuideArticleStatus;
  heroMedia: SiteMedia | null;
  heroMobileMedia: SiteMedia | null;
  seoTitle: string | null;
  seoDescription: string | null;
  seoCanonicalPath: string | null;
  seoNoIndex: boolean;
  seoOgMedia: SiteMedia | null;
  searchKeywords: readonly string[];
  readingTimeMinutes: number | null;
  isFeatured: boolean;
  blockCount: number;
  publishedAt: string | null;
  topics: readonly GuideTopic[];
  blocks: readonly GuideArticleBlock[];
  productIds: readonly string[];
  categoryIds: readonly string[];
  brandIds: readonly string[];
  version: number;
  createdAt: string;
  updatedAt: string;
}>;

export type GuideArticleList = Readonly<{
  items: readonly GuideArticle[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}>;

export type GuideFilters = Readonly<{
  q: string;
  status: GuideArticleStatus | '';
  format: GuideArticleFormat | '';
  topic: string;
  page: number;
  limit: number;
}>;

export type GuideFormReferences = Readonly<{
  topics: readonly GuideTopic[];
  products: readonly ProductRelationCandidate[];
  categories: readonly CatalogLookup[];
  brands: readonly CatalogLookup[];
}>;

const STATUSES = new Set<GuideArticleStatus>(['DRAFT', 'PUBLISHED', 'ARCHIVED']);
const FORMATS = new Set<GuideArticleFormat>([
  'GUIDE',
  'ANSWER',
  'BUYING_GUIDE',
  'CARE_GUIDE',
  'COMPARISON',
  'STORY',
]);
const BLOCK_TYPES = new Set<GuideBlockType>([
  'LEAD',
  'RICH_TEXT',
  'IMAGE',
  'IMAGE_TEXT',
  'STEPS',
  'QUOTE',
  'TABLE',
  'FAQ',
  'GALLERY',
  'PRODUCT_CARDS',
  'CTA',
  'DIVIDER',
]);

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function integer(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null;
}

function media(value: unknown): SiteMedia | null {
  const item = record(value);
  const id = text(item?.id);
  const mimeType = text(item?.mimeType);
  if (!id || !mimeType) return null;
  return { id, mimeType, url: text(item?.url), altText: text(item?.altText) };
}

export function parseGuideTopic(value: unknown): GuideTopic | null {
  const item = record(value);
  const id = text(item?.id);
  const name = text(item?.name);
  const slug = text(item?.slug);
  const sortOrder = integer(item?.sortOrder);
  if (!id || !name || !slug || sortOrder === null || typeof item?.isActive !== 'boolean')
    return null;
  return {
    id,
    name,
    slug,
    description: text(item.description),
    coverMedia: media(item.coverMedia),
    seoTitle: text(item.seoTitle),
    seoDescription: text(item.seoDescription),
    seoCanonicalPath: text(item.seoCanonicalPath),
    seoNoIndex: item.seoNoIndex === true,
    sortOrder,
    isActive: item.isActive,
  };
}

export function parseGuideTopics(value: unknown): readonly GuideTopic[] | null {
  if (!Array.isArray(value)) return null;
  const topics = value.map(parseGuideTopic);
  return topics.every((topic): topic is GuideTopic => topic !== null) ? topics : null;
}

function parseBlock(value: unknown): GuideArticleBlock | null {
  const item = record(value);
  if (!item) return null;
  const id = text(item?.id);
  const type = text(item?.type) as GuideBlockType | null;
  const sortOrder = integer(item?.sortOrder);
  const content = record(item?.content);
  if (!id || !type || !BLOCK_TYPES.has(type) || sortOrder === null || !content) return null;
  return {
    id,
    type,
    variant: text(item.variant),
    anchorId: text(item.anchorId),
    primaryMedia: media(item.primaryMedia),
    content,
    sortOrder,
  };
}

export function parseGuideArticle(value: unknown): GuideArticle | null {
  const item = record(value);
  if (!item) return null;
  const id = text(item?.id);
  const title = text(item?.title);
  const slug = text(item?.slug);
  const status = text(item?.status) as GuideArticleStatus | null;
  const format = text(item?.format) as GuideArticleFormat | null;
  const version = integer(item?.version);
  const updatedAt = text(item?.updatedAt);
  const blockCount = integer(item?.blockCount);
  if (
    !id ||
    !title ||
    !slug ||
    !status ||
    !STATUSES.has(status) ||
    !format ||
    !FORMATS.has(format) ||
    version === null ||
    !updatedAt
  )
    return null;
  const topics = Array.isArray(item.topics) ? item.topics.map(parseGuideTopic) : [];
  if (!topics.every((topic): topic is GuideTopic => topic !== null)) return null;
  const blocks = Array.isArray(item.blocks) ? item.blocks.map(parseBlock) : [];
  if (!blocks.every((block): block is GuideArticleBlock => block !== null)) return null;
  const stringArray = (input: unknown) =>
    Array.isArray(input) ? input.filter((entry): entry is string => typeof entry === 'string') : [];
  return {
    id,
    title,
    slug,
    eyebrow: text(item.eyebrow),
    excerpt: text(item.excerpt),
    format,
    status,
    heroMedia: media(item.heroMedia),
    heroMobileMedia: media(item.heroMobileMedia),
    seoTitle: text(item.seoTitle),
    seoDescription: text(item.seoDescription),
    seoCanonicalPath: text(item.seoCanonicalPath),
    seoNoIndex: item.seoNoIndex === true,
    seoOgMedia: media(item.seoOgMedia),
    searchKeywords: stringArray(item.searchKeywords),
    readingTimeMinutes: integer(item.readingTimeMinutes),
    isFeatured: item.isFeatured === true,
    blockCount: blockCount ?? blocks.length,
    publishedAt: text(item.publishedAt),
    topics,
    blocks,
    productIds: stringArray(item.productIds),
    categoryIds: stringArray(item.categoryIds),
    brandIds: stringArray(item.brandIds),
    version,
    createdAt: text(item.createdAt) ?? updatedAt,
    updatedAt,
  };
}

export function parseGuideArticleList(value: unknown): GuideArticleList | null {
  const item = record(value);
  if (!Array.isArray(item?.items)) return null;
  const articles = item.items.map(parseGuideArticle);
  const total = integer(item.total);
  const page = integer(item.page);
  const limit = integer(item.limit);
  const totalPages = integer(item.totalPages);
  if (
    !articles.every((article): article is GuideArticle => article !== null) ||
    total === null ||
    page === null ||
    limit === null ||
    totalPages === null
  )
    return null;
  return { items: articles, total, page, limit, totalPages };
}

export function guideStatusLabel(status: GuideArticleStatus): string {
  return { DRAFT: 'پیش‌نویس', PUBLISHED: 'منتشرشده', ARCHIVED: 'آرشیوشده' }[status];
}

export function guideFormatLabel(format: GuideArticleFormat): string {
  return {
    GUIDE: 'راهنمای کاربردی',
    ANSWER: 'پاسخ به پرسش',
    BUYING_GUIDE: 'راهنمای خرید',
    CARE_GUIDE: 'نگهداری و مراقبت',
    COMPARISON: 'مقایسه',
    STORY: 'داستان و شناخت',
  }[format];
}

export function guideBlockLabel(type: GuideBlockType): string {
  return {
    LEAD: 'مقدمه برجسته',
    RICH_TEXT: 'متن',
    IMAGE: 'تصویر',
    IMAGE_TEXT: 'تصویر و متن',
    STEPS: 'مراحل',
    QUOTE: 'نقل‌قول',
    TABLE: 'جدول',
    FAQ: 'پرسش و پاسخ',
    GALLERY: 'گالری',
    PRODUCT_CARDS: 'محصولات پیشنهادی',
    CTA: 'دعوت به اقدام',
    DIVIDER: 'جداکننده',
  }[type];
}
