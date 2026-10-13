import 'server-only';

import { cookies } from 'next/headers';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { requestAdminCatalog, readJsonResponse } from '@/lib/catalog/catalog-api';
import { loadProductForm } from '@/lib/catalog/catalog-data';
import {
  parseGuideArticle,
  parseGuideArticleList,
  parseGuideTopics,
  type GuideArticle,
  type GuideArticleList,
  type GuideFilters,
  type GuideFormReferences,
  type GuideTopic,
} from './guide-model';

export type GuideManagementData = Readonly<{
  articles: GuideArticleList | null;
  topics: readonly GuideTopic[];
  failed: boolean;
}>;

async function token(): Promise<string> {
  const value = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!value) throw new Error('Authenticated admin session is required.');
  return value;
}

export async function loadGuideManagement(filters: GuideFilters): Promise<GuideManagementData> {
  const accessToken = await token();
  const query = new URLSearchParams({ page: String(filters.page), limit: String(filters.limit) });
  if (filters.q) query.set('q', filters.q);
  if (filters.status) query.set('status', filters.status);
  if (filters.format) query.set('format', filters.format);
  if (filters.topic) query.set('topic', filters.topic);
  try {
    const [articlesResponse, topicsResponse] = await Promise.all([
      requestAdminCatalog(`/api/v1/guide/articles?${query.toString()}`, accessToken),
      requestAdminCatalog('/api/v1/guide/topics', accessToken),
    ]);
    if (!articlesResponse.ok || !topicsResponse.ok)
      return { articles: null, topics: [], failed: true };
    const articles = parseGuideArticleList(await readJsonResponse(articlesResponse));
    const topics = parseGuideTopics(await readJsonResponse(topicsResponse));
    return articles && topics
      ? { articles, topics, failed: false }
      : { articles: null, topics: [], failed: true };
  } catch {
    return { articles: null, topics: [], failed: true };
  }
}

export async function loadGuideForm(articleId?: string): Promise<{
  article: GuideArticle | null;
  references: GuideFormReferences;
} | null> {
  const accessToken = await token();
  try {
    const [articleResponse, topicsResponse, catalog] = await Promise.all([
      articleId
        ? requestAdminCatalog(
            `/api/v1/guide/articles/${encodeURIComponent(articleId)}`,
            accessToken,
          )
        : Promise.resolve(null),
      requestAdminCatalog('/api/v1/guide/topics', accessToken),
      loadProductForm(),
    ]);
    if ((articleResponse && !articleResponse.ok) || !topicsResponse.ok || !catalog) return null;
    const article = articleResponse
      ? parseGuideArticle(await readJsonResponse(articleResponse))
      : null;
    const topics = parseGuideTopics(await readJsonResponse(topicsResponse));
    if ((articleId && !article) || !topics || !catalog.products) return null;
    return {
      article,
      references: {
        topics,
        products: catalog.products,
        categories: catalog.categories,
        brands: catalog.brands,
      },
    };
  } catch {
    return null;
  }
}
