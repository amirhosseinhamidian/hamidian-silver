import { describe, expect, it } from 'vitest';

import {
  buildGuideHref,
  parseGuideSearchParams,
  parsePublicGuideArticle,
  parsePublicGuideArticleList,
  parsePublicGuideArticleSummaries,
} from '@/lib/guide/public-guide';

const summary = {
  id: 'article-1',
  title: 'چطور نقره اصل را تشخیص دهیم؟',
  slug: 'recognize-real-silver',
  format: 'ANSWER',
  status: 'PUBLISHED',
  eyebrow: null,
  excerpt: 'چند نشانه کاربردی برای بررسی نقره',
  heroMedia: null,
  cardMedia: null,
  seoCanonicalPath: null,
  seoNoIndex: false,
  seoOgMedia: null,
  readingTimeMinutes: 5,
  isFeatured: true,
  publishedAt: '2026-10-12T10:00:00.000Z',
  topics: [],
  updatedAt: '2026-10-12T11:00:00.000Z',
};

describe('public guide data', () => {
  it('normalizes filters and preserves them in pagination links', () => {
    const filters = parseGuideSearchParams({
      q: ' نقره اصل ',
      topic: 'silver',
      format: 'ANSWER',
      page: '2',
    });
    expect(filters).toEqual({
      q: 'نقره اصل',
      topic: 'silver',
      format: 'ANSWER',
      page: 2,
      limit: 12,
    });
    expect(buildGuideHref(filters, 3)).toBe(
      '/guide?q=%D9%86%D9%82%D8%B1%D9%87+%D8%A7%D8%B5%D9%84&topic=silver&format=ANSWER&page=3',
    );
  });

  it('parses the public summary list without requiring editor-only fields', () => {
    expect(
      parsePublicGuideArticleList({
        items: [summary],
        total: 1,
        page: 1,
        limit: 12,
        totalPages: 1,
      }),
    ).toMatchObject({ items: [{ slug: 'recognize-real-silver' }], total: 1 });
  });

  it('rejects unknown block types while accepting related products', () => {
    const article = {
      ...summary,
      heroMobileMedia: null,
      productRecommendationMode: 'MANUAL',
      seoTitle: null,
      seoDescription: null,
      searchKeywords: ['نقره'],
      createdAt: summary.publishedAt,
      blocks: [
        {
          id: 'block-1',
          type: 'FAQ',
          variant: 'accordion',
          anchorId: 'questions',
          primaryMedia: null,
          content: { items: [{ question: 'عیار مناسب چیست؟', answer: 'عیار ۹۲۵ رایج است.' }] },
          sortOrder: 0,
        },
      ],
      relatedProducts: [
        {
          id: 'product-1',
          name: 'انگشتر نقره',
          slug: 'silver-ring',
          shortDescription: null,
          salePriceToman: 1_000_000,
          primaryMedia: null,
        },
      ],
      relatedCategories: [{ id: 'category-1', name: 'انگشتر', slug: 'rings' }],
      relatedBrands: [{ id: 'brand-1', name: 'برند نمونه', slug: 'sample-brand' }],
      relatedArticles: [{ ...summary, id: 'article-2', slug: 'ring-size' }],
    };
    expect(parsePublicGuideArticle(article)).toMatchObject({
      blocks: [{ type: 'FAQ' }],
      relatedProducts: [{ slug: 'silver-ring' }],
      relatedCategories: [{ slug: 'rings' }],
      relatedBrands: [{ slug: 'sample-brand' }],
      relatedArticles: [{ slug: 'ring-size' }],
    });
    expect(
      parsePublicGuideArticle({
        ...article,
        blocks: [{ ...article.blocks[0], type: 'RAW_HTML' }],
      }),
    ).toBeNull();
  });

  it('rejects a malformed contextual guide response instead of rendering partial links', () => {
    expect(parsePublicGuideArticleSummaries([summary])).toHaveLength(1);
    expect(parsePublicGuideArticleSummaries([{ ...summary, slug: null }])).toBeNull();
  });
});
