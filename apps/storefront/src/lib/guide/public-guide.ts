import { cache } from 'react';

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

export type PublicGuideMedia = Readonly<{
  id: string;
  url: string | null;
  mimeType: string;
  altText: string | null;
}>;

export type PublicGuideTopic = Readonly<{
  id: string;
  name: string;
  slug: string;
  description: string | null;
  coverMedia: PublicGuideMedia | null;
}>;

export type PublicGuideArticleSummary = Readonly<{
  id: string;
  title: string;
  slug: string;
  eyebrow: string | null;
  excerpt: string | null;
  format: GuideArticleFormat;
  heroMedia: PublicGuideMedia | null;
  seoCanonicalPath: string | null;
  seoNoIndex: boolean;
  seoOgMedia: PublicGuideMedia | null;
  readingTimeMinutes: number | null;
  isFeatured: boolean;
  publishedAt: string | null;
  topics: readonly PublicGuideTopic[];
  updatedAt: string;
}>;

export type PublicGuideBlock = Readonly<{
  id: string;
  type: GuideBlockType;
  variant: string | null;
  anchorId: string | null;
  primaryMedia: PublicGuideMedia | null;
  content: Readonly<Record<string, unknown>>;
  sortOrder: number;
}>;

export type PublicGuideRelatedProduct = Readonly<{
  id: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  salePriceToman: number | null;
  primaryMedia: PublicGuideMedia | null;
}>;

export type PublicGuideCollectionLink = Readonly<{
  id: string;
  name: string;
  slug: string;
}>;

export type PublicGuideArticle = PublicGuideArticleSummary &
  Readonly<{
    heroMobileMedia: PublicGuideMedia | null;
    seoTitle: string | null;
    seoDescription: string | null;
    searchKeywords: readonly string[];
    blocks: readonly PublicGuideBlock[];
    relatedProducts: readonly PublicGuideRelatedProduct[];
    relatedCategories: readonly PublicGuideCollectionLink[];
    relatedBrands: readonly PublicGuideCollectionLink[];
    relatedArticles: readonly PublicGuideArticleSummary[];
    createdAt: string;
  }>;

export type PublicGuideArticleList = Readonly<{
  items: readonly PublicGuideArticleSummary[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}>;

export type GuideSearchParams = Readonly<Record<string, string | string[] | undefined>>;
export type GuideFilters = Readonly<{
  page: number;
  limit: number;
  q?: string;
  topic?: string;
  format?: GuideArticleFormat;
}>;

export type RelatedGuideContext = Readonly<{
  product?: string;
  categories?: readonly string[];
  brand?: string;
  limit?: number;
}>;

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

function media(value: unknown): PublicGuideMedia | null {
  const item = record(value);
  const id = text(item?.id);
  const mimeType = text(item?.mimeType);
  if (!id || !mimeType) return null;
  return { id, mimeType, url: text(item?.url), altText: text(item?.altText) };
}

export function parsePublicGuideTopic(value: unknown): PublicGuideTopic | null {
  const item = record(value);
  const id = text(item?.id);
  const name = text(item?.name);
  const slug = text(item?.slug);
  if (!item || !id || !name || !slug) return null;
  return {
    id,
    name,
    slug,
    description: text(item.description),
    coverMedia: media(item.coverMedia),
  };
}

function parseSummary(value: unknown): PublicGuideArticleSummary | null {
  const item = record(value);
  const id = text(item?.id);
  const title = text(item?.title);
  const slug = text(item?.slug);
  const format = text(item?.format) as GuideArticleFormat | null;
  const updatedAt = text(item?.updatedAt);
  if (!item || !id || !title || !slug || !format || !FORMATS.has(format) || !updatedAt) return null;
  const topics = Array.isArray(item.topics) ? item.topics.map(parsePublicGuideTopic) : [];
  if (!topics.every((topic): topic is PublicGuideTopic => topic !== null)) return null;
  return {
    id,
    title,
    slug,
    eyebrow: text(item.eyebrow),
    excerpt: text(item.excerpt),
    format,
    heroMedia: media(item.heroMedia),
    seoCanonicalPath: text(item.seoCanonicalPath),
    seoNoIndex: item.seoNoIndex === true,
    seoOgMedia: media(item.seoOgMedia),
    readingTimeMinutes: integer(item.readingTimeMinutes),
    isFeatured: item.isFeatured === true,
    publishedAt: text(item.publishedAt),
    topics,
    updatedAt,
  };
}

function parseBlock(value: unknown): PublicGuideBlock | null {
  const item = record(value);
  const id = text(item?.id);
  const type = text(item?.type) as GuideBlockType | null;
  const sortOrder = integer(item?.sortOrder);
  const content = record(item?.content);
  if (!item || !id || !type || !BLOCK_TYPES.has(type) || sortOrder === null || !content)
    return null;
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

function parseRelatedProduct(value: unknown): PublicGuideRelatedProduct | null {
  const item = record(value);
  const id = text(item?.id);
  const name = text(item?.name);
  const slug = text(item?.slug);
  if (!item || !id || !name || !slug) return null;
  return {
    id,
    name,
    slug,
    shortDescription: text(item.shortDescription),
    salePriceToman: integer(item.salePriceToman),
    primaryMedia: media(item.primaryMedia),
  };
}

function parseCollectionLink(value: unknown): PublicGuideCollectionLink | null {
  const item = record(value);
  const id = text(item?.id);
  const name = text(item?.name);
  const slug = text(item?.slug);
  return item && id && name && slug ? { id, name, slug } : null;
}

export function parsePublicGuideArticle(value: unknown): PublicGuideArticle | null {
  const summary = parseSummary(value);
  const item = record(value);
  if (!summary || !item) return null;
  const blocks = Array.isArray(item.blocks) ? item.blocks.map(parseBlock) : null;
  const relatedProducts = Array.isArray(item.relatedProducts)
    ? item.relatedProducts.map(parseRelatedProduct)
    : [];
  const relatedCategories = Array.isArray(item.relatedCategories)
    ? item.relatedCategories.map(parseCollectionLink)
    : [];
  const relatedBrands = Array.isArray(item.relatedBrands)
    ? item.relatedBrands.map(parseCollectionLink)
    : [];
  const relatedArticles = Array.isArray(item.relatedArticles)
    ? item.relatedArticles.map(parseSummary)
    : [];
  if (
    !blocks ||
    !blocks.every((block): block is PublicGuideBlock => block !== null) ||
    !relatedProducts.every((product): product is PublicGuideRelatedProduct => product !== null) ||
    !relatedCategories.every(
      (category): category is PublicGuideCollectionLink => category !== null,
    ) ||
    !relatedBrands.every((brand): brand is PublicGuideCollectionLink => brand !== null) ||
    !relatedArticles.every((article): article is PublicGuideArticleSummary => article !== null)
  )
    return null;
  return {
    ...summary,
    heroMobileMedia: media(item.heroMobileMedia),
    seoTitle: text(item.seoTitle),
    seoDescription: text(item.seoDescription),
    searchKeywords: Array.isArray(item.searchKeywords)
      ? item.searchKeywords.filter((entry): entry is string => typeof entry === 'string')
      : [],
    blocks,
    relatedProducts,
    relatedCategories,
    relatedBrands,
    relatedArticles,
    createdAt: text(item.createdAt) ?? summary.updatedAt,
  };
}

export function parsePublicGuideArticleSummaries(
  value: unknown,
): readonly PublicGuideArticleSummary[] | null {
  if (!Array.isArray(value)) return null;
  const articles = value.map(parseSummary);
  return articles.every((article): article is PublicGuideArticleSummary => article !== null)
    ? articles
    : null;
}

export function parsePublicGuideArticleList(value: unknown): PublicGuideArticleList | null {
  const item = record(value);
  if (!Array.isArray(item?.items)) return null;
  const items = item.items.map(parseSummary);
  const total = integer(item.total);
  const page = integer(item.page);
  const limit = integer(item.limit);
  const totalPages = integer(item.totalPages);
  if (
    !items.every((article): article is PublicGuideArticleSummary => article !== null) ||
    total === null ||
    page === null ||
    limit === null ||
    totalPages === null
  )
    return null;
  return { items, total, page, limit, totalPages };
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseGuideSearchParams(searchParams: GuideSearchParams): GuideFilters {
  const rawPage = Number(first(searchParams.page));
  const rawFormat = first(searchParams.format)?.trim() as GuideArticleFormat | undefined;
  const normalized = (value: string | string[] | undefined) => first(value)?.trim() || undefined;
  return {
    page: Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1,
    limit: 12,
    q: normalized(searchParams.q),
    topic: normalized(searchParams.topic),
    format: rawFormat && FORMATS.has(rawFormat) ? rawFormat : undefined,
  };
}

export function buildGuideHref(filters: GuideFilters, page = filters.page): string {
  const query = new URLSearchParams();
  if (filters.q) query.set('q', filters.q);
  if (filters.topic) query.set('topic', filters.topic);
  if (filters.format) query.set('format', filters.format);
  if (page > 1) query.set('page', String(page));
  return query.size ? `/guide?${query}` : '/guide';
}

function apiUrl(pathname: string): URL {
  const origin = process.env.HAMIDIAN_API_ORIGIN;
  if (!origin) throw new Error('HAMIDIAN_API_ORIGIN is required for public guide pages.');
  return new URL(pathname, origin);
}

async function publicGuideFetch(pathname: string): Promise<Response> {
  return fetch(apiUrl(pathname), { next: { revalidate: 300, tags: ['public-guide'] } });
}

export const getPublicGuideTopics = cache(async (): Promise<readonly PublicGuideTopic[]> => {
  const response = await publicGuideFetch('/api/v1/guide/public/topics');
  const payload: unknown = await response.json();
  const topics = Array.isArray(payload) ? payload.map(parsePublicGuideTopic) : null;
  if (!response.ok || !topics?.every((topic): topic is PublicGuideTopic => topic !== null))
    throw new Error('Failed to load public guide topics.');
  return topics;
});

export const getPublicGuideArticles = cache(
  async (filters: GuideFilters): Promise<PublicGuideArticleList> => {
    const url = apiUrl('/api/v1/guide/public/articles');
    url.searchParams.set('page', String(filters.page));
    url.searchParams.set('limit', String(filters.limit));
    if (filters.q) url.searchParams.set('q', filters.q);
    if (filters.topic) url.searchParams.set('topic', filters.topic);
    if (filters.format) url.searchParams.set('format', filters.format);
    const response = await fetch(url, { next: { revalidate: 300, tags: ['public-guide'] } });
    const parsed = parsePublicGuideArticleList(await response.json());
    if (!response.ok || !parsed) throw new Error('Failed to load public guide articles.');
    return parsed;
  },
);

export const getPublicGuideArticle = cache(
  async (slug: string): Promise<PublicGuideArticle | null> => {
    const response = await publicGuideFetch(
      `/api/v1/guide/public/articles/${encodeURIComponent(slug)}`,
    );
    if (response.status === 404) return null;
    const parsed = parsePublicGuideArticle(await response.json());
    if (!response.ok || !parsed) throw new Error('Failed to load the public guide article.');
    return parsed;
  },
);

export const getPublicRelatedGuideArticles = cache(
  async (context: RelatedGuideContext): Promise<readonly PublicGuideArticleSummary[]> => {
    const url = apiUrl('/api/v1/guide/public/related-articles');
    if (context.product) url.searchParams.set('product', context.product);
    if (context.categories?.length)
      url.searchParams.set('categories', [...new Set(context.categories)].join(','));
    if (context.brand) url.searchParams.set('brand', context.brand);
    if (context.limit) url.searchParams.set('limit', String(context.limit));
    if (!context.product && !context.categories?.length && !context.brand) return [];

    const response = await fetch(url, { next: { revalidate: 300, tags: ['public-guide'] } });
    const parsed = parsePublicGuideArticleSummaries(await response.json());
    if (!response.ok || !parsed) throw new Error('Failed to load related guide articles.');
    return parsed;
  },
);

export async function getAllPublicGuideArticles(): Promise<PublicGuideArticleSummary[]> {
  const firstPage = await getPublicGuideArticles({ page: 1, limit: 48 });
  const articles = [...firstPage.items];
  for (let page = 2; page <= firstPage.totalPages; page += 1) {
    articles.push(...(await getPublicGuideArticles({ page, limit: 48 })).items);
  }
  return articles;
}

export function guideFormatLabel(format: GuideArticleFormat): string {
  return {
    GUIDE: 'راهنمای کاربردی',
    ANSWER: 'پاسخ روشن',
    BUYING_GUIDE: 'راهنمای خرید',
    CARE_GUIDE: 'نگهداری و مراقبت',
    COMPARISON: 'مقایسه',
    STORY: 'روایت و شناخت',
  }[format];
}
